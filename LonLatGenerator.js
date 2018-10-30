// Starting with a location csv file,
// loop through city/states and generate a new flat file which also includes lat/lon

// Import Libs
const nodemailer = require('nodemailer');
const fs = require('fs'); // eslint-disable-line
const https = require('https'); // eslint-disable-line
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const Secrets = require('./secrets/secrets');// This resource is not in Source Control, replace Secrets.X with your own info

const transport = new winston.transports.DailyRotateFile({
  filename: path.resolve(__dirname, './Log-%DATE%.txt'),
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
    subject: 'Email Subject!', // Subject line
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
  // got list of cities into google sheets
  // exported to csv file from sheets
  // converted to json using cli csvtojson cmd below
  // csvtojson EventCities.csv > EventCities.json
  // parse json file into code
  const cities = JSON.parse(fs.readFileSync(path.resolve(__dirname, './EventCities.json')));
  // save updated json object
  fs.writeFileSync(path.resolve(__dirname, './EventCities.json'), JSON.stringify(cities));
} catch (err) {
  logger.error(`Unexpected Error: ${err}`);
}
