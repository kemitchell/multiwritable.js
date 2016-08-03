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

  var finishedSinkCount = 0
  var sinkCount = 0
  var currentSink = null

  var transformOptions = {
    writableObjectMode: objectMode,
    readableObjectMode: objectMode
  }

  var proxy = through2(transformOptions)

  var repiper = through2(transformOptions, transform, flush)

  function transform (chunk, encoding, callback) {
    var self = this
    sinkFactory(
      currentSink, chunk, encoding,
      function (error, nextSink) {
        if (error) {
          callback(error)
        } else {
          if (nextSink !== currentSink) {
            if (currentSink) {
              proxy.unpipe()
              if (endSinks) {
                currentSink.end()
              }
            }
            if (endSinks) {
              nextSink.once('finish', function () {
                finishedSinkCount++
                if (finishedSinkCount === sinkCount) {
                  emit.call(repiper, 'finish')
                }
              })
            }
            proxy.pipe(nextSink, {end: endSinks})
            currentSink = nextSink
            sinkCount++
          }
          self.push(chunk, encoding)
          callback()
        }
      }
    )
  }

  function flush (callback) {
    if (endSinks) {
      currentSink.end()
    }
    callback()
  }

  if (endSinks) {
    repiper.emit = function doNotEmitNormalFinish (event) {
      if (event !== 'finish') {
        emit.apply(this, slice.call(arguments))
      }
    }
  }

  repiper.pipe(proxy, {end: endSinks})

  return repiper
}
