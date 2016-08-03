var MultiWritable = require('./')
var from2Array = require('from2-array')
var fs = require('fs')
var mktempd = require('temporary-directory')
var path = require('path')
var pump = require('pump')
var tape = require('tape')

tape('succession of files', function (test) {
  mktempd(function (error, directory, cleanUp) {
    test.ifError(error, 'no error')
    var data = ['a', 'b', 'c', 'd']
    var files = ['1', '2', '3', '4'].map(function (fileName) {
      return path.join(directory, fileName)
    })
    var source = from2Array.obj(data)
    var factory = (function () {
      var count = 0
      return function (current, chunk, encoding, callback) {
        var file = files[count++]
        var writeStream = fs.createWriteStream(file)
        callback(null, writeStream)
      }
    })()
    var options = {
      end: true,
      objectMode: true
    }
    pump(source, new MultiWritable(factory, options))
    .once('finish', function () {
      test.deepEqual(
        fs.readdirSync(directory),
        ['1', '2', '3', '4'],
        'creates files'
      )
      files.forEach(function (file, index) {
        var fileContent = fs.readFileSync(file, {encoding: 'ascii'})
        test.equal(fileContent, data[index], 'reads ' + data[index])
      })
      cleanUp()
      test.end()
    })
  })
})
