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

var mime = require('mime')
var charsetRegExp = /;\s*charset\s*=/;

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
    return this.set('Content-Type', ct);
  }
  
  json(body) {
    this.body = JSON.stringify(body)
    if (!this.get('Content-Type')) {
      this.set('Content-Type', 'application/json');
    }
    return this
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
        errorMessage: err.message
      })
    } else {
      // we clear out the body explicitly in case it was set by user before
      return this.json("null")
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

function createResponse() {
  return new LambdaResponse()
}

module.exports = createResponse