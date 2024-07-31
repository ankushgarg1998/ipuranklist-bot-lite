var fs = require('fs');
const axios = require('axios');
const { JSDOM } = require("jsdom");
const { Telegram } = require('telegraf');

var { log } = require('./util/logger');
var dataObj = JSON.parse(fs.readFileSync('./data/data.json', 'utf8'));


// -----------------------------------------------------------------------------------------------
// === INITIALIZATIONS ===
// Telegram object for sending texts on cron runs.
const tg = new Telegram(process.env.BOT_TOKEN);
const markD = { "parse_mode": "Markdown" };


// -----------------------------------------------------------------------------------------------
// === HELPER FUCTIONS ===
// Function to extract 10 result lines from the result HTML Page.
function extractEntriesFromPage(entryType, htmlPage) {
    let numberOfEntries = 10;
    let html = new JSDOM(htmlPage);
    // let tb = html.window.document.querySelector("table").lastElementChild;
    let tb = html.window.document.querySelector("table").firstElementChild;
    let rows = [...tb.children].slice(1, numberOfEntries);
    let message = `📅 *RECENT ${numberOfEntries} ${entryType.toUpperCase()}S :*\n\n`;
    rows.forEach(row => {
        let dateElementMessage = "---";
        if (row.children.length !== 1) {
            dateElementMessage = getPossiblySpanWrappedElement(row.lastElementChild);
        }
        message += `*${dateElementMessage}:*\n`;
        let titleElementMessage = getPossiblySpanWrappedElement(row.firstElementChild);
        message += `${sanitizePdfTitle(titleElementMessage)}\n\n`;
    });
    return message;
}

// Get possibly span wrapped element
function getPossiblySpanWrappedElement(element) {
    let elementString = element.innerHTML.trim();
    return elementString.replace(/<\/?[^>]+(>|$)/g, '');
}

// Sanitize PDF Title
function sanitizePdfTitle(title) {
    return title
        .replace('\n\t', '')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace('_', '-').trim();
}

// Writes the content of dataObj to the data.json file.
function writeDataFile() {
    fs.writeFileSync('./data/data.json', JSON.stringify(dataObj, null, 4), 'utf8', (err) => {
        if (err) {
            log('=> Error in writing data to file:');
            log(err);
        } else {
            log('=> Data written to file successfully.');
        }
    });
}

// -----------------------------------------------------------------------------------------------
// === TELEGRAM CRON HANDLER FUNCTIONS ===
// Function to handle 'cron' executions
function handleCronExecution(entryType) {
    log(`Running the new-${entryType} checker.`);
    axios.get(dataObj.urls[entryType]).then(res => {
        let message = extractEntriesFromPage(entryType, res.data);
        console.log(message);
        if (message !== dataObj.savedMessages[entryType]) {
            log(`=> Found updated ${entryType} entries.`);
            notifyMaster(entryType, message);
            dataObj.savedMessages[entryType] = message;
            writeDataFile();
        } else {
            log('=> No updates.\n');
        }
    }, err => {
        log(`=> Error in cron execution:`);
        log(err);
        tg.sendMessage(dataObj.masterChatID, `Yo Ankush. Some error occured in ${entryType}-checker cron.\n`, markD)
            .then(val => log(`=> Notified Ankush.`))
            .catch(err => {
                log('=> Unable to notify Ankush about the error :');
                log(err);
            });
    });
};

function notifyMaster(entryType, message) {
    log(`=> Sending to ${dataObj.masterChatID}: ${dataObj.masterUserName}`);
    tg.sendMessage(dataObj.masterChatID, `🔴 *NEW ${entryType.toUpperCase()} ALERT*\n\n` + message, markD)
        .then(val => log(`=> Successful notification to ${dataObj.masterChatID}: ${dataObj.masterUserName}.`))
        .catch(err => {
            log(`=> Unable to notify Ankush about updates in ${entryType} :`);
            log(err);
        });
};

// -----------------------------------------------------------------------------------------------
// === LAUNCH ===
// Launching the cron.
handleCronExecution('result');