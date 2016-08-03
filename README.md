```javascript
var MultiWritable = require('multiwritable')
var fs = require('fs')

var sinkFactory = (function () {
  var chunksPerFile = 10
  var count = 0
  return function batch (currentSink, chunk, encoding, callback) {
    count++
    if (count % chunksPerFile === 0) {
      var fileName = Math.floor(count / chunksPerFile) + '.txt'
      var newSink = fs.createWriteStream(fileName))
      callback(null, newSink)
    } else {
      callback(null, currentSink)
    }
  }
})()

var writable = MultiWritable(sinkFactory, {
  // End each sink when done writing to it.
  end: true,
  objectMode: false
})
writable.write('first')
// ...
writable.end()
```

Inspired by Feross Aboukhadijeh's [multistream].

[multistream]: https://www.npmjs.com/package/multistream
