const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

const middleware = require('@line/bot-sdk').middleware
const JSONParseError = require('@line/bot-sdk').JSONParseError
const SignatureValidationFailed = require('@line/bot-sdk').SignatureValidationFailed

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(middleware(config))
  .post('/webhook', (req, res) => {
    res.json(req.body.events) // req.body will be webhook event object
  })

  .use((err, req, res, next) => {
    if (err instanceof SignatureValidationFailed) {
      res.status(401).send(err.signature)
      return
    } else if (err instanceof JSONParseError) {
      res.status(400).send(err.raw)
      return
    }
    next(err) // will throw default 500
  })

  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
