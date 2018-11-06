// Starting with a location csv file,
// loop through city/states and generate a new flat file which also includes lat/lon

// Import Libs
const nodemailer = require('nodemailer');
const fs = require('fs'); // eslint-disable-line
// const _ = require('lodash');
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

  const calcIs300MilesFromCC = (lat1, lon1) => {
    const unit = 'N'; // Miles
    const lat2 = 27.8005828;
    const lon2 = -97.39638099999999;
    const radlat1 = Math.PI * lat1 / 180;
    const radlat2 = Math.PI * lat2 / 180;
    const theta = lon1 - lon2;
    const radtheta = Math.PI * theta / 180;
    let dist = Math.sin(radlat1)
      * Math.sin(radlat2)
      + Math.cos(radlat1)
      * Math.cos(radlat2)
      * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;
    if (unit === 'K') { dist *= 1.609344; }
    if (unit === 'N') { dist *= 0.8684; }
    console.log(dist);
    return (dist <= 300); // return bool value if input param is within 300 miles of CC
  };


  // got list of cities into google sheets
  // exported to csv file from sheets
  // converted to json using cli csvtojson cmd below
  // csvtojson EventCities.csv > EventCities.json
  // parse json file into code
  const cities = JSON.parse(fs.readFileSync(path.resolve(__dirname, './EventCities.json')));

  const execLoop = async () => {
    for (let x = 0;
      x < Object.keys(cities).length;
      x += 1) {
      if (cities[x].Lon !== '') { // only find lat/lon if not already set
        console.log(cities[x].City);
        cities[x].Is300MilesFromCC = calcIs300MilesFromCC(cities[x].Lat, cities[x].Lon);
      }
    }
    fs.writeFileSync(path.resolve(__dirname, './EventCities.json'), JSON.stringify(cities));
  };
  execLoop();
  // save updated json object
} catch (err) {
  logger.error(`Unexpected Error: ${err}`);
}
