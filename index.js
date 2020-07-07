const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const bodyParser = require('body-parser');

const pg = require('pg');

const uuid = require('uuid');

const configfile = require('./config');
const line = require('@line/bot-sdk');

const dialogflow = require('dialogflow');

//B
pg.defaults.ssl = true;

const config = {
  channelAccessToken: configfile.linechannelAccessToken,
  channelSecret: configfile.linechannelSecret
};

// create LINE SDK client
const client = new line.Client(config);

const credentials = {
  client_email: configfile.GOOGLE_CLIENT_EMAIL,
  private_key: configfile.GOOGLE_PRIVATE_KEY
};

const sessionClient = new dialogflow.SessionsClient(
  {
      projectId: configfile.GOOGLE_PROJECT_ID,
      credentials
  }
);
const sessionIds = new Map();

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(bodyParser.json())
  


  .post('/webhook/', (req, res) => {
    
    try {
      req.body.events.map(handleEvent)
      
    } catch (err) {
      console.error(err);
        res.status(500).end();
    }      
  })

  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))



  // event handler
function handleEvent(event) {
  
  if (event.replyToken && event.replyToken.match(/^(.)\1*$/)) {
    return console.log("Test hook recieved: " + JSON.stringify(event.message));
  }

  switch (event.type) {
    case 'message':
      const message = event.message;
      switch (message.type) {
        case 'text':

        
          //return handleText(message, event.replyToken, event.source);
          var senderID = event.source.userId;
          
          var timeOfMessage = event.timestamp;

          if (!sessionIds.has(senderID)) { 
            // kiểm tra xem trong cái sessionIds (là 1 map) xem là có senderID hay không.tác dụng hàm has.dấu ! tức là nếu ko có senderID
           sessionIds.set(senderID, uuid.v1());   // thì tạo 1 set mới
           }
          
          var messageText = message.text;
          if (messageText) {
            //send message to api.ai @@ gửi nó đến DialogFlow
            sendToDialogFlow(senderID, messageText,event.replyToken,timeOfMessage); 
          }          
         break;

        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }
      break;    

    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }

}



async function sendToDialogFlow(sender, textString, replyToken,timeOfMessage, params) {  

  

  try { //try này giúp dialogFlow theo dõi cụ thể ng dùng trong cái sesion đó
      const sessionPath = sessionClient.sessionPath(
          configfile.GOOGLE_PROJECT_ID,
          sessionIds.get(sender)
      );

      // gửi văn bản tới dialogflow
      const request = {
          session: sessionPath,
          queryInput: {
              text: {
                  text: textString,
                  languageCode: configfile.DF_LANGUAGE_CODE,
              },
          },
          queryParams: {
              payload: {
                  data: params
              }
          }
      };

      // khi có phản hồi từ dialogflow thì ta xử lí nó
      const responses = await sessionClient.detectIntent(request);
      
      // đọc cái mà dialogflow gửi cho ta
      const result = responses[0].queryResult;
      handleDialogFlowResponse(sender, result, replyToken,timeOfMessage);
      
      console.log(' da vao sendToDialogFlow')
  } catch (e) {
      console.log('error');
      console.log(e);
  }

}

function handleDialogFlowResponse(sender, response, replyToken,timeOfMessage) {
  // phân tích cái mà dialogFlow gửi về
  //console.log(response);
  let responseText = response.fulfillmentMessages.fulfillmentText;

  let messages = response.fulfillmentMessages;
  let action = response.action;
  let contexts = response.outputContexts;
  let parameters = response.parameters;
  console.log(JSON.stringify(responseText));
  

  if (isDefined(action)) {
      handleDialogFlowAction(sender, action, messages, contexts, parameters, replyToken,timeOfMessage);
      console.log('handleDialogFlowResponse defined action'); 
  } else if (isDefined(messages)) {
      handleMessages(messages, replyToken);//////////////////////////////////////
      console.log('handleDialogFlowResponse defined messages-if not setting action on DF');
      
  } 
}

function handleDialogFlowAction(sender, action, messages, contexts, parameters,replyToken, timeOfMessage) {
  switch (action) {    

    case 'start':
      console.log('da vao dc start');
      start(sender);
      handleMessages( messages,replyToken);    
      break;

    
    case 'sub3':
      console.log('da vao dc sub3')
      let filteredContextsSub3 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('isubmit_userinfo-yes-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsSub3.length > 0 && contexts[0].parameters){

        let username = (contexts[0].parameters.fields['username']) && contexts[0].parameters.fields['username'] !='' ? contexts[0].parameters.fields["username"].stringValue : '';        
        let userID = (contexts[0].parameters.fields['userID']) && contexts[0].parameters.fields['userID'] !='' ? contexts[0].parameters.fields["userID"].stringValue : '';
        let userAdd = (contexts[0].parameters.fields['userAdd']) && contexts[0].parameters.fields['userAdd'] !='' ? contexts[0].parameters.fields["userAdd"].stringValue : '';        
        
        let senddataSub3 = {
          username:username,          
          userID:userID,
          userAdd:userAdd,
          time_update:timeOfMessage          
        };

        updateInfoUser(sender,senddataSub3);
        handleMessages( messages,replyToken);     
      }
    break;

    case 'safe3':
      console.log('da vao dc safe3')
      let filteredContextsSafe3 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('submit_safe-custom-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsSafe3.length > 0 && contexts[0].parameters){

        let issafe = (contexts[0].parameters.fields['issafe']) && contexts[0].parameters.fields['issafe'] !='' ? contexts[0].parameters.fields["issafe"].stringValue : '';        
        let safelocation = (contexts[0].parameters.fields['safelocation']) && contexts[0].parameters.fields['safelocation'] !='' ? contexts[0].parameters.fields["safelocation"].stringValue : '';
        let safemess = (contexts[0].parameters.fields['safemess']) && contexts[0].parameters.fields['safemess'] !='' ? contexts[0].parameters.fields["safemess"].stringValue : '';        

        let senddataSafe3 = {
          issafe:issafe,          
          safelocation:safelocation,
          safemess:safemess,
          time_update:timeOfMessage                    
        };

        updateInfoSafe(sender,senddataSafe3);
        handleMessages( messages,replyToken);        
      }
    break;
      
    case 'temp2':
       

      console.log('da vao dc temp２')
      let filteredContextsTemp2 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('isubmit_bodytemp-custom-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsTemp2.length > 0 && contexts[0].parameters){

        let bodytemperature2 = (contexts[0].parameters.fields['bodytemperature']) && contexts[0].parameters.fields['bodytemperature'] !='' ? contexts[0].parameters.fields["bodytemperature"].stringValue : '';        
        
        if(bodytemperature2 !== ''){
          console.log('da vao dc temp２ if1')
          //handleMessages( messages,replyToken);
          //send button
          sendButtonMessage(replyToken,messages);

        }else{
          console.log('da vao dc temp２ if2')
          handleMessages( messages,replyToken);
        }
          
      }else{
        console.log('da vao dc temp２ if3')
        handleMessages( messages,replyToken);
      }
      
    break;

    case 'temp3':
      console.log('da vao dc temp3')
      let filteredContextsTemp3 = contexts.filter(function (el){ //Phương thức filter() dùng để tạo một mảng mới với tất cả các phần tử thỏa điều kiện của một hàm test.
        return el.name.includes('isubmit_bodytemp-custom-followup') //name of contexts......ten cua cai context luu cac gia tri.
      });
      if (filteredContextsTemp3.length > 0 && contexts[0].parameters){

        let bodytemperature3 = (contexts[0].parameters.fields['bodytemperature']) && contexts[0].parameters.fields['bodytemperature'] !='' ? contexts[0].parameters.fields["bodytemperature"].stringValue : '';        
        
        let senddataTemp3 = {
          bodytemperature:bodytemperature3,            
          temp_time:timeOfMessage                    
        };

        updateInfoTemp(sender,senddataTemp3);
        handleMessages( messages,replyToken);        
      }
    break;

    default:
      console.log('da vao dc default case');
      console.log(replyToken);   
      //console.log(JSON.stringify(messages));       
      handleMessages( messages,replyToken);
    
  }  
}


function handleMessages(messages, sender) {
  
  let timeoutInterval = 1100;  
  let timeout = 0;
  for (var i = 0; i < messages.length; i++) {

    if(i == messages.length - 1)  {
        
        timeout = i * timeoutInterval;
        setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
        console.log('da vao handleMessages');
    }      
  }
}

function handleMessage(message, token) {
    switch (message.message) {
        case "text": //text
            console.log("da vao case text");
            
            message.text.text.forEach((text) => {
                if (text !== '') {
                    sendTextMessage(token, text);
                    console.log(text);
                }
            });
            break;        
    }
}

function sendTextMessage(token, texts) {
  texts = Array.isArray(texts) ? texts : [texts];

  console.log("da gui tin nhan ");
  return client.replyMessage(
    token,
    texts.map((text) => ({ type: 'text', text }))
  );
}

function sendButtonMessage(token,messages) {
  
  console.log("da gui button ");
  //console.log(messages);
  //console.log(messages[messages.length - 1]);
  //console.log(messages[messages.length - 1].quickReplies.title);
  

  
  return client.replyMessage(
    token,
    {
      type: 'template',
      altText: 'Buttons alt text',
      template: {
        type: 'buttons',
        
        title: 'ご確認下さい',
        text: messages[messages.length - 1].quickReplies.title,
        actions: [
          
          { label: '確認', type: 'message', text: '確認' },
          { label: 'やり直し', type: 'message', text: 'やり直し' },
        ],
      },
    }
  );
}

function start(userId, replyToken){
  client.getProfile(userId)
  .then((profile) => {
    //console.log(profile.displayName);
    console.log(profile.userId);
    //console.log(profile.pictureUrl);
    //console.log(profile.statusMessage);
    
    if (profile.displayName) {
          
      var pool = new pg.Pool(configfile.PG_CONFIG);
      pool.connect(function(err, client, done) {
          if (err) {
              return console.error('Error acquiring client', err.stack);
          }
          var rows = [];
          client.query(`SELECT line_userid FROM users_line WHERE line_userid='${userId}' LIMIT 1`,
              function(err, result) {
                  if (err) {
                      console.log('Query error: ' + err);
                  } else {
                      if (result.rows.length === 0) {
                          let sql = 'INSERT INTO users_line (line_userid, displayname, pictureurl, statusmessage) ' +
                              'VALUES ($1, $2, $3, $4)';
                          client.query(sql,
                              [
                                  userId,
                                  profile.displayName,
                                  profile.pictureUrl,
                                  profile.statusMessage,
                                  
                              ]);
                      }
                  }
              });
          
      });
      pool.end();
      
      //sendTextMessage(replyToken,"da xong");
      
    } 
  })
  .catch((err) => {
    
  });

}

function updateInfoUser(line_id,senddata) {
  console.log('da vao updateUserinfo vs line_id ben duoi');
  console.log(line_id);

  var pool = new pg.Pool(configfile.PG_CONFIG);
  pool.connect(function(err, client, done) {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    let sql = 'UPDATE public.users_line SET user_name=$1, user_id=$2, user_address=$3, time_update=$4 WHERE line_userid=$5';

    client.query(sql,
        [
          senddata.username,
          senddata.userID,
          senddata.userAdd, 
          senddata.time_update,
          line_id
        ]);

  });
  pool.end();  
	//tao 1 cai query lay gia tri cua ca cai cot vua in vao xong in gtri do ra mot bang khac de backup
}

function updateInfoSafe(line_id,senddata) {
  console.log('da vao addinfosafe vs fb_id ben duoi');
  console.log(line_id);

  var pool = new pg.Pool(configfile.PG_CONFIG);
  pool.connect(function(err, client, done) {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
      let sql = 'INSERT INTO safe_check (line_id, is_safe, safe_location, safe_mess, time_update) ' + 'VALUES ($1, $2, $3, $4, $5)';
                                  
    client.query(sql,
        [
          line_id,
          senddata.issafe,
          senddata.safelocation,
          senddata.safemess,
          senddata.time_update          
          
        ]);

  });
  pool.end();  
	
}

function updateInfoTemp(line_id,senddata) {
  console.log('da vao addinfoTemp3 vs line_id ben duoi');
  console.log(line_id);

  var pool = new pg.Pool(configfile.PG_CONFIG);
  pool.connect(function(err, client, done) {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
      let sql = 'INSERT INTO temp_check (line_id, temp, temp_time) ' + 'VALUES ($1, $2, $3)';
                                  
    client.query(sql,
        [
          line_id,
          senddata.bodytemperature,
          senddata.temp_time
                    
        ]);

  });
  pool.end();  
	
}

function isDefined(obj) {
  if (typeof obj == 'undefined') {
      return false;
  }

  if (!obj) {
      return false;
  }

  return obj != null;
}