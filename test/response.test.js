const createResponse = require('../lib/response')
const createError = require('http-errors')

describe('Response status and headers', () => {
  it ('should set the status code', async () => {
    var res = createResponse()
    expect(res.status(500)).toMatchObject({ "statusCode": 500 })
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

