```javascript
var MultiWritable = require('multiwritable')
var fs = require('fs')

var factory = (function () {
  var chunksPerFile = 10
  var count = 0
  return function batch (current, chunk, encoding, callback) {
    count++
    if (count % chunksPerFile === 0) {
      callback(null, fs.createWriteStream(
        Math.floor(count / chunksPerFile) + '.txt'
      ))
    } else {
      callback(null, current)
    }
  }
})()

var writable = MultiWritable(factory, {end: true})
writable.write('first')
// ...
writable.end()
```

Inspired by Feross Aboukhadijeh's [multistream].

[multistream]: https://www.npmjs.com/package/multistream
