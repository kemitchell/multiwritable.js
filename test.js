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

tape('same sink', function (test) {
  mktempd(function (error, directory, cleanUp) {
    test.ifError(error, 'no error')
    var data = ['a', 'b', 'c', 'd']
    var source = from2Array.obj(data)
    var sink = fs.createWriteStream(path.join(directory, 'output'))
    var factory = function (current, chunk, encoding, callback) {
      callback(null, sink)
    }
    var options = {end: true}
    pump(source, new MultiWritable(factory, options))
    .once('finish', function () {
      test.equal(
        fs.readFileSync(sink.path).toString(),
        data.join(''),
        'all data written to sink'
      )
      cleanUp()
      test.end()
    })
  })
})

tape('not ending sinks', function (test) {
  mktempd(function (error, directory, cleanUp) {
    test.ifError(error, 'no error')
    var data = ['a', 'b', 'c', 'd']
    var files = ['1', '2', '3', '4'].map(function (fileName) {
      return path.join(directory, fileName)
    })
    var sinks = files.map(function (file) {
      return fs.createWriteStream(file)
    })
    var source = from2Array.obj(data)
    var factory = (function () {
      var count = 0
      return function (current, chunk, encoding, callback) {
        callback(null, sinks[count++])
      }
    })()
    var options = {end: false}
    sinks.forEach(function (sink) {
      sink.once('finish', /* istanbul ignore next */ function () {
        test.fail('sink finished prematurely')
      })
    })
    pump(source, new MultiWritable(factory, options))
    .once('finish', function () {
      sinks.forEach(function (sink) {
        sink.removeAllListeners('finish')
        sink.end()
      })
      test.pass('sinks were not finished')
      cleanUp()
      test.end()
    })
  })
})

tape('error from factory', function (test) {
  mktempd(function (error, directory, cleanUp) {
    test.ifError(error, 'no error')
    var source = from2Array.obj(['a', 'b', 'c', 'd'])
    var ERROR = 'some error'
    var factory = function (current, chunk, encoding, callback) {
      callback(ERROR)
    }
    var options = {end: false}
    pump(source, new MultiWritable(factory, options))
    .once('error', function (error) {
      test.equal(error, ERROR, 'emits error')
      cleanUp()
      test.end()
    })
  })
})
