const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

//const config = require('./config');
const line = require('@line/bot-sdk');

const middleware = require('@line/bot-sdk').middleware
const JSONParseError = require('@line/bot-sdk').JSONParseError
const SignatureValidationFailed = require('@line/bot-sdk').SignatureValidationFailed

const config = {
  channelAccessToken: "Wdpil7pCXn0op3JRgmNOc5XfZK3wAMKsBmfRJs9Vequy1XRLspbd/mVVvU9npoGhbFKB5PL1G0SthiURGs/Jhbb3Qx53BWAkokWs7rKwc6Dr4HwEl+iBMAmqSpseEyqkbkPqok2/OmYny1WRwltBdgdB04t89/1O/w1cDnyilFU=",
  channelSecret: "aca85f39faf12058882f5cb5a67230c7"
};

// create LINE SDK client
const client = new line.Client(config);

express()
  .use(express.static(path.join(__dirname, 'public')))

  .use(middleware(config))

  .post('/webhook/', line.middleware(config), (req, res) => {
    Promise
      .all(req.body.events.map(handleEvent))
      .then((result) => res.json(result))
      .catch((err) => {
        console.error(err);
        res.status(500).end();
      });
  })

  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))



  // event handler
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // create a echoing text message
  const echo = { type: 'text', text: event.message.text };

  // use reply API
  return client.replyMessage(event.replyToken, echo);
}