var EventEmitter = require('events').EventEmitter
var firstDefined = require('defined')
var through2 = require('through2')

var emit = EventEmitter.prototype.emit
var slice = Array.prototype.slice

module.exports = MultiWritable

//                                             (Returned to User)
// +------------------------+                +---------------------+
// | Function `sinkFactory` |<-- on chunk --<| Transform `repiper` |
// +------------------------+                +---------------------+
//   1 2 ... n                                 |  |
//   v v     v                                 |  | .pipe()
//   | |     |                                 |  |
//   | |     |  +-----------------------------------------------------+
//   | |     |  | Transform `proxy`                                   |
//   | |     |  +-----------------------------------------------------+
//   | |     |    |  |              |  |                  |  |
//   | |     |    |  |              |  | .unpipe()        |  | .pipe()
//   | |     |    |  | .pipe()      |  | .pipe()          |  |
//   | |     |    |  |              |  |                  |  |
//   | |     |  +-------------+   +-------------+       +-------------+
//   | |     |  | Writable #1 | , | Writable #2 | , ... | Writable #n |
//   | |     |  +-------------+   +-------------+       +-------------+
//   | |     |         ^                 ^                     ^
//   | |     |         |                 |                     |
//   +-|-----|---------+                 |                     |
//     |     |                           |                     |
//     +-----|---------------------------+                     |
//           |                                                 |
//           +-------------------------------------------------+

function MultiWritable (sinkFactory, options) {
  options = firstDefined(options, {})
  var endSinks = firstDefined(options.end, true)
  var objectMode = firstDefined(options.objectMode, false)

  // The number of sinks that have emitted finish events.  Used to
  // determine when to emit a finish event from the returned stream.
  var finishedSinkCount = 0

  // The number of sinks that have been piped.  Once `finishedSinkCount`
  // equals `sinkCount`, we know all piped sinks have emitted finish
  // events.
  var sinkCount = 0

  // The current sink `Writable` stream.
  var currentSink = null

  // Options for transforms in the pipeline.
  var transformOptions = {
    writableObjectMode: objectMode,
    readableObjectMode: objectMode
  }

  // See the big fancy ASCII diagram above.
  var proxy = through2(transformOptions)
  var repiper = through2(transformOptions, _transform, _flush)
  repiper.pipe(proxy, {end: endSinks})

  function _transform (chunk, encoding, callback) {
    var self = this
    // Call the sink factory function for the next sink.
    sinkFactory(
      currentSink, chunk, encoding,
      function (error, nextSink) {
        if (error) {
          callback(error)
        } else {
          // Handle a new sink.
          if (nextSink !== currentSink) {
            // Unpipe from any current sink.  Call `writable.end()` if
            // we are configured to do so.
            if (currentSink) {
              proxy.unpipe()
              if (endSinks) {
                currentSink.end()
              }
            }
            // If we are configured to end `Writable` sinks, attach an
            // event listener so we know when to emit a finish event on
            // the `Writable` we return to users.
            if (endSinks) {
              nextSink.once('finish', function () {
                // If all sink `Writable`s have emitted finish events...
                finishedSinkCount++
                if (finishedSinkCount === sinkCount) {
                  // ...emit a finish event from the returned
                  // `Writable`, using `.emit` from `EventEmitter`'s
                  // prototype, since we override `.emit` on the
                  // `Writable` to prevent emitting the default finish
                  // event below.
                  emit.call(repiper, 'finish')
                }
              })
            }
            // Pipe the proxy to the new sink.
            proxy.pipe(nextSink, {end: endSinks})
            currentSink = nextSink
            sinkCount++
          }
          // Pass data through.  The `Writable` we return is actually a
          // fancy `PassThrough`.
          self.push(chunk, encoding)
          callback()
        }
      }
    )
  }

  function _flush (callback) {
    if (endSinks) {
      currentSink.end()
    }
    callback()
  }

  // If we are configured to end sink `Writable` streams, stop the
  // returned `Writable` from emitting its default finish event.  We
  // will emit a finish event once the last `Writable` sink finishes.
  if (endSinks) {
    repiper.emit = function doNotEmitNormalFinish (event) {
      if (event !== 'finish') {
        emit.apply(this, slice.call(arguments))
      }
    }
  }

  return repiper
}
