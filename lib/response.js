// https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-create-api-as-simple-proxy-for-lambda.html#api-gateway-proxy-integration-lambda-function-nodejs

// // The output from a Lambda proxy integration must be 
// // of the following JSON object. The 'headers' property 
// // is for custom response headers in addition to standard 
// // ones. The 'body' property  must be a JSON string. For 
// // base64-encoded payload, you must also set the 'isBase64Encoded'
// // property to 'true'.
// var response = {
//     statusCode: responseCode,
//     headers: {
//         "x-custom-header" : "my custom header value"
//     },
//     body: JSON.stringify(responseBody)
// };

// https://expressjs.com/en/guide/routing.html
// Method	Description
// res.download()	Prompt a file to be downloaded.
// res.end()	End the response process.
// res.json()	Send a JSON response.
// res.jsonp()	Send a JSON response with JSONP support.
// res.redirect()	Redirect a request.
// res.render()	Render a view template.
// res.send()	Send a response of various types.
// res.sendFile()	Send a file as an octet stream.
// res.sendStatus()	Set the response status code and send its string representation as the response body.

const fs = require('fs')
const path = require('path')
const http = require('http')
const stream = require('stream');

const mime = require('mime')
const charsetRegExp = /;\s*charset\s*=/;
const TYPEDARRAYS = [
  "Float32Array", "Float64Array",
	"Int8Array", "Int16Array", "Int32Array",
	"Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array"
]

class LambdaResponse {
  constructor() {
    this.statusCode = 200
    this.headers = { }
    this.body = null,
    this.isBase64Encoded = false
  }
  
  status(code) {
    this.statusCode = code
    return this
  }
  
  statusDesc(code) {
    return http.STATUS_CODES[ code || this.statusCode ]
  }
  
  get(field) {
    return this.getHeader(field)
  }
  
  set(field, val) {
    if (arguments.length === 2) {
      var value = Array.isArray(val)
        ? val.map(String)
        : String(val);
  
      // add charset to content-type
      if (field.toLowerCase() === 'content-type') {
        if (Array.isArray(value)) {
          throw new TypeError('Content-Type cannot be set to an Array');
        }
        if (!charsetRegExp.test(value)) {
          var charset = mime.charsets.lookup(value.split(';')[0]);
          if (charset) value += '; charset=' + charset.toLowerCase();
        }
      }
      this.setHeader(field, value);
    } else {
      for (var key in field) {
        this.set(key, field[key]);
      }
    }
    return this;
  }

  type(s) {
    var ct = s.indexOf('/') === -1 ? mime.lookup(s) : s
    return this.set('Content-Type', ct || 'application/octet-stream');
  }
  
  json(body) {
    this.body = JSON.stringify(body)
    if (!this.get('Content-Type')) {
      this.set('Content-Type', 'application/json');
    }
    return this
  }
  
  redirect(path) {
    if (this.statusCode < 300 || this.statusCode >= 400) {
      this.status(302) // 302 Found is Express default
    }
    this.set('Location', path)
    return this
  }
  
  async download(f, options) {
    options = options || { }
    options.disposition = options.disposition || 'attachment'
    return this.blob(f, options)
  }
  
  async file(f, options) {
    options = options || { }
    options.disposition = options.disposition || 'inline'
    return this.blob(f, options)
  }
  
  // S3 getObject can return data 
  // in these formats: Buffer, Typed Array, Blob, String, ReadableStream
  // if we want to have an easy way to return 
  // something from s3 someone can pass data straight from these 
  // Blob looks like just client-side JS so that leaves
  // Buffer, 
  
  async blob(f, options) {
    options = options || { }
    
    if (!this.get('Content-Disposition')) {
      var disposition = options.disposition || 'inline'
      if (options.filename) {
        disposition = `${disposition}; filename="${options.filename}"`
      }
      this.set('Content-Disposition', disposition)
    }
    
    if (typeof f === 'string') {
      return this.filename(f)
    }
    if (f instanceof stream.Readable) {
      return await this.stream(f)
    }
    if (f instanceof Buffer) {
      return this.base64(f)
    }
    if (isTypedArray(f)) {
      // // Copies the contents of `arr`
      // const buf1 = Buffer.from(arr);
      // // Shares memory with `arr`
      // const buf2 = Buffer.from(arr.buffer);
      return this.base64(Buffer.from(f.buffer))
    }
    throw new Error("Unknown file object")
  }
  
  async stream(stream) {
    var buf = await readStreamToBuffer(stream)
    return this.base64(buf)
  }
  
  filename(name) {
    var fpath = path.resolve(name)
    var ext = name.split('.').pop()
    this.type(ext)
    var buf = fs.readFileSync(fpath)
    return this.base64(buf)
  }
  
  base64(buf) {
    this.body = buf.toString('base64')
    this.isBase64Encoded = true
    return this
  }
  
  render() {
    
  }
  
  error(err) {
    if (err.statusCode) {
      this.status(err.statusCode)
    } else if (this.statusCode < 400) {
      this.status(500)
    } 
    var expose = (this.statusCode >= 400 && this.statusCode < 500) || false
    if (err.expose) {
      expose = err.expose
    }
    if (expose) {
      return this.json({
        errorMessage: err.message || http.STATUS_CODES[this.statusCode]
      })
    } else {
      // we clear out the body explicitly in case it was set by user before
      return this.json({
        errorMessage: http.STATUS_CODES[this.statusCode]
      })
    }
  }
  
  // PRIVATE
  getHeader(field) {
    return this.headers[field.toLowerCase()]  
  }
  
  setHeader(field, value) {
    this.headers[field.toLowerCase()] = value
  }
}

function createResponse(data) {
  if (!data) return new LambdaResponse()
  var res = new LambdaResponse()
  if (data instanceof Error) {
    return res.error(data)
  }
  if (typeof data === 'object') {
    return res.json(data)
  }
  return new Error("Unsupported data type")
}

function isTypedArray(arr) {
  var n = arr.constructor.name
  return TYPEDARRAYS.indexOf(n) >= 0 ? n : false
}

async function readStreamToBuffer(readable) {
  var bufs = []
  return new Promise(function(resolve, reject) {
    readable.on('data', (chunk) => {
      bufs.push(chunk)
    })
    readable.on('error', (err) => {
      reject(err)
      return
    })
    readable.on('end', () => {
      resolve(Buffer.concat(bufs))
      return
    })
  })
}

function inferResponse(data) {
  
}

module.exports = createResponse