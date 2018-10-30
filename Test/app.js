// Import Libs
const nodemailer = require('nodemailer');
const fs = require('fs');
const https = require('https');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const Secrets = require('./secrets/secrets');// This resource is not in Source Control, replace Secrets.X with your own info

const transport = new winston.transports.DailyRotateFile({
  filename: path.resolve(__dirname, './StockWatchLog-%DATE%.txt'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '15d',
});

const myFormat = winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`);

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    myFormat,
  ),
  transports: [
    new winston.transports.Console(),
    transport,
  ],
});

logger.info('Application Start');

try {
  // Configs
  const minPercentIncrease = 10;
  const minNotifyMarketCap = 2000000000;
  const stockAlertCooldownInMs = (1000 * 60 * 60 * 24 * 7);// 7 days;
  const apiUrl = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&lang=en-US&region=US&scrIds=day_gainers&start=0&count=3';
  logger.info('Config Values');
  logger.info(`Percent Increase Threshold:${minPercentIncrease.toString()}`);
  logger.info(`Min Market Cap Threshold:${minNotifyMarketCap.toString()}`);
  logger.info(`Alert Cooldown Increase in Days:${(stockAlertCooldownInMs / (1000 * 60 * 60 * 24)).toString()}`);

  logger.info('Parse Alert History Json');
  const alertHistory = JSON.parse(fs.readFileSync(path.resolve(__dirname, './alertHistory.json')));

  logger.info('Set up Main Transport');
  // Setup Email Services
  const transporter = nodemailer.createTransport({ // eslint-disable-line no-unused-vars
    service: 'gmail',
    auth: {
      user: Secrets.gmailUsername,
      pass: Secrets.gmailPassword,
    },
  });
  const mailOptions = { // eslint-disable-line no-unused-vars
    from: Secrets.gmailUsername, // sender address
    to: Secrets.notifyTargetEmail, // list of receivers
    subject: 'Stock Watch Alert!', // Subject line
    html: '', // plain text body
  };
  const sendEmailProd = (msg) => { // eslint-disable-line no-unused-vars
    mailOptions.html = msg;
    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        logger.info(error);
      } else {
        logger.info(`Email Sent: ${msg}`);
      }
    });
  };
  const sendEmailTest = (msg) => { // eslint-disable-line no-unused-vars
    logger.info(msg); // eslint-disable-line no-console
  };
  // End Email Config

  // Business Logic Functions

  const checkAlertHistory = (ticker) => { // eslint-disable-line no-unused-vars
    if (alertHistory[ticker] == null) {
      return true;
    }
    if (alertHistory[ticker].alertTime < (Date.now() - stockAlertCooldownInMs)) {
      return true;
    }
    return false;
  };

  const updateAlertHistory = (ticker) => { // eslint-disable-line no-unused-vars
    alertHistory[ticker] = { alertTime: Date.now() };
    logger.info(`Ticker: ${ticker} updated in json History file with time: ${alertHistory[ticker].alertTime}`);
  };

  const saveAlertHistory = () => {
    fs.writeFileSync(path.resolve(__dirname, './alertHistory.json'), JSON.stringify(alertHistory));
  };

  const CycleThroughStocks = (stockJson) => {
    logger.info('Cycle through Stocks, where thresholds are met');
    stockJson.finance.result[0].quotes.forEach((qoute) => {
      if (qoute.marketCap.raw > minNotifyMarketCap
        && qoute.regularMarketChangePercent.raw > minPercentIncrease
        && checkAlertHistory(qoute.symbol)) {
        logger.info(`Stock: ${qoute.symbol} matches within boundry conditions`);
        updateAlertHistory(qoute.symbol);
        sendEmailProd(`Stock: ${qoute.symbol} 
        Percent Change: ${qoute.regularMarketChangePercent.fmt}
        Market Cap: ${qoute.marketCap.fmt}`);
      }
    });
    saveAlertHistory();
  };
  logger.info('Pull Top Performing Stocks From Api');
  // Pull Stocks info from API
  https.get(apiUrl, (response) => {
    let body = '';
    response.on('data', (chunk) => {
      body += chunk;
    });
    response.on('end', () => {
      const stockInfo = JSON.parse(body);
      CycleThroughStocks(stockInfo);
    });
  });
} catch (err) {
  logger.error(`Unexpected Error: ${err}`);
}
