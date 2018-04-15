const fs = require('fs')
const createResponse = require('../lib/response')
const createError = require('http-errors')

describe('Response status and headers', () => {
  it ('should set the status code', async () => {
    var res = createResponse()
    expect(res.status(500)).toMatchObject({ "statusCode": 500 })
    expect(res.statusDesc()).toBe('Internal Server Error')
  })
  it ('should set the header value', async () => {
    var res = createResponse()
    expect(res.set('Content-Type', 'image/png')).toMatchObject({
      headers: {
        'content-type': 'image/png'
      }
    })
  })
  it ('should set the charset for content-type', async () => {
    var res = createResponse()
    expect(res.set('Content-Type', 'text/plain')).toMatchObject({
      headers: {
        'content-type': 'text/plain; charset=utf-8'
      }
    })
  })
  it ('should set the header using type', async () => {
    var res = createResponse()
    expect(res.type('text')).toMatchObject({
      headers: {
        'content-type': 'text/plain; charset=utf-8'
      }
    })
  })
  it ('should get the header value', async () => {
    var res = createResponse()
    res.set('Content-Type', 'image/png')
    expect(res.get('Content-Type')).toBe('image/png')
    expect(res.get('content-type')).toBe('image/png')
  })
}) 

describe('createResponse handler', () => {
  it ('should return data as is if already in Lambda Proxy Integration format', async () => {
    var ret = {
      statusCode: 400,
      body: "hello"
    }
    expect(await createResponse(ret)).toMatchObject({
      statusCode: 400,
      body: "hello"
    })
  })
})
describe('JSON response', () => {
  it ('should set a simple body as json and set the content-type', async () => {
    var res = createResponse()
    var body = { "hello": "world" }
    expect(res.json(body)).toMatchObject({
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(body)
    })
  })
})

describe('Redirect response', () => {
  it ('should return a 302 Found by default', () => {
    var res = createResponse()
    expect(res.redirect("https://google.com")).toMatchObject({
      statusCode: 302,
      headers: {
        'location': "https://google.com"
      }
    })
  })
  it ('should preserve redirect status set by user', () => {
    var res = createResponse()
    // 301 Moved Permanently
    expect(res.status(301).redirect('/hello/world')).toMatchObject({
      statusCode: 301
    })
  })
})

const JPEGJPGBASE64 = "/9j/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k="

describe('Blob response', () => {
  it ('should read an image file as a base64 string', () => {
    var data = fs.readFileSync(`${__dirname}/jpeg.jpg`, 'base64')
    expect(data).toBe(JPEGJPGBASE64)
  })
  it ('should be able to handle relative and absolute filenames', async () => {
    var res = createResponse()
    expect(await res.blob("test/jpeg.jpg")).toMatchObject({
      headers: {
        "content-type": "image/jpeg"
      },
      body: JPEGJPGBASE64
    })
    var res = createResponse()
    expect(await res.blob(`${__dirname}/jpeg.jpg`)).toMatchObject({
      headers: {
        "content-type": "image/jpeg"
      },
      body: JPEGJPGBASE64
    })
  })
  it ('should be able to handle a file as a readablestream', async () => {
    var res = createResponse()
    var readable = fs.createReadStream(`${__dirname}/jpeg.jpg`)
    expect(await res.blob(readable)).toMatchObject({
      body: JPEGJPGBASE64
    })
  })
  it ('should be able to handle a file as a buffer', async () => {
    var res = createResponse()
    var buf = fs.readFileSync(`${__dirname}/jpeg.jpg`)
    expect(await res.blob(buf)).toMatchObject({
      body: JPEGJPGBASE64
    })
  })
  it ('should be able to handle a file as a typed array', async () => {
    var res = createResponse()
    const HELLOBASE64 = 'aGVsbG8='
    var hello = new Uint8Array([ 104, 101, 108, 108, 111 ])
    var buf = Buffer.from(hello.buffer)
    expect(buf.toString('utf-8')).toBe('hello')
    expect(buf.toString('base64')).toBe(HELLOBASE64)
    expect(await res.blob(hello)).toMatchObject({
      body: HELLOBASE64
    })
  })
})

describe('Download response', () => {
  it ('should set the Content-Disposition header as attachment', async () => {
    var res = createResponse()
    expect(await res.download("test/jpeg.jpg")).toMatchObject({
      headers: {
        "content-disposition": "attachment"
      }
    })
    res = createResponse()
    expect(await res.download("test/jpeg.jpg", { filename: "My Picture.jpeg" })).toMatchObject({
      headers: {
        "content-disposition": `attachment; filename="My Picture.jpeg"`
      } 
    })
  })
})

describe('File response', () => {
  it ('should set the Content-Disposition header as inline', async () => {
    var res = createResponse()
    expect(await res.file("test/jpeg.jpg")).toMatchObject({
      headers: {
        "content-disposition": "inline"
      }
    })
    res = createResponse()
    expect(await res.file("test/jpeg.jpg", { filename: "My Picture.jpeg" })).toMatchObject({
      headers: {
        "content-disposition": `inline; filename="My Picture.jpeg"`
      } 
    })
  })
})

describe('Error response', () => {
  it ('should format a vanilla error as 500 with no message', async () => {
    var res = createResponse()
    var err = new Error("This message should be hidden")
    expect(res.error(err)).toMatchObject({
      statusCode: 500,
      body: JSON.stringify({
        errorMessage: "Internal Server Error"
      })
    })
  })
  it ('should format a manually enhanced error with status and message', async () => {
    var res = createResponse()
    var err = new Error("Bad request error")
    err.statusCode = 400
    expect(res.error(err)).toMatchObject({
      statusCode: 400,
      body: JSON.stringify({ 
        errorMessage: err.message
      })
    })
    var err2 = new Error("Bad Gateway")
    err2.statusCode = 502
    expect(res.error(err2)).toMatchObject({
      statusCode: 502,
      body: JSON.stringify({
        errorMessage: "Bad Gateway"
      })
    })
    err2.expose = true
    expect(res.error(err2)).toMatchObject({
      statusCode: 502,
      body: JSON.stringify({
        errorMessage: "Bad Gateway"
      })
    })
  })
  it ('should format an error created by the http-errors package', async () => {
    var res = createResponse()
    var err = createError(404, 'This video does not exist!')
    expect(err.statusCode).toBe(404)
    expect(res.error(err)).toMatchObject({
      statusCode: 404,
      body: JSON.stringify({
        errorMessage: 'This video does not exist!'
      })
    })
    var err2 = createError.NotImplemented()
    expect(res.error(err2)).toMatchObject({
      statusCode: 501,
      body: JSON.stringify({
        errorMessage: "Not Implemented"
      })
    })
    var err3 = createError(501, 'Not implemented and you will see this message', { expose: true })
    expect(res.error(err3)).toMatchObject({
      statusCode: 501,
      body: JSON.stringify({
        errorMessage: 'Not implemented and you will see this message'
      })
    })
  })
})

