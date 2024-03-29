/* eslint no-console: 0 */

'use strict';

// mms.js
const {SMTPServer} = require('smtp-server');
const SMTPConnection = require('nodemailer/lib/smtp-connection');
const log4js = require('log4js');
const axios = require('axios');
const crypto = require('crypto');
const constants = require('./constants');

log4js.configure({
    appenders: {
        everything: { type: 'dateFile', filename: 'log/all-the-logs.log', daysToKeep: 10, compress: true }
    },
    categories: {
        default: { appenders: [ 'everything' ], level: constants.LOGLEVEL }
    }
});

const logger = log4js.getLogger();
logger.level = constants.LOGLEVEL;

let connCount = 0;

function computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function checkHash(initial, current) {
    return initial === current;
}

const server = new SMTPServer({
    // disable STARTTLS to allow authentication in clear text mode
    banner: 'Welcome to the KONTXT SMTP MTA Emulator',
    disabledCommands: ['STARTTLS', 'AUTH'],
    logger: false,
    size: constants.MAXSIZE,
    maxClients: constants.MAXCLIENTS,
    onConnect ( session, callback ) {
        connCount++;
        logger.info( 'Number of concurrent connections: ' + connCount );
        return callback();
    },
    onClose( session ) {
        if( connCount >= 1 ) {
            connCount--;
        } else {
            connCount = 0;
        }
    },
    onData (stream, session, callback ) {

        let chunks = [];
        let smtpEntryHash = '';

        stream.pipe(process.stdout); // print message to console

        stream.on( 'data', (chunk) => {
            chunks.push(chunk);
        });

        stream.on('end', () => {

            // keep message AS IS in raw format
            let rawSmtp = Buffer.concat(chunks)

            logger.info( `Message ${computeHash(rawSmtp)} received` );

            smtpEntryHash = computeHash(rawSmtp);

            logger.debug( 'Payload features: ' + constants.KONTXTFEATURE );
            logger.debug( 'Payload rawSmtp: ' + rawSmtp.toString() );

            //establish connection to remote MTA
            let connection = new SMTPConnection( {
                port: constants.DESTPORT,
                host: constants.DESTIP,
                secure: false,
                ignoreTLS: true,
                connectionTimeout: 5000,
                debug: false,
                name: 'mms.relay.kontxt.cloud'
            });

            // if this is set, we will simply relay, return, and not scan
            if( constants.SKIPKONTXTSCAN ) {

                connection.connect(() => {

                    logger.error('Scan skipped. CONNECTION ESTABLISHED TO REMOTE MTA ');

                    connection.send({
                        from: session.envelope.mailFrom,
                        to: session.envelope.rcptTo
                    }, rawSmtp, function (err, info) {

                        logger.error('Scan skipped. Caught KONTXT API Error: relayed to remote MTA.' +
                            '; Message envelope from: ' + session.envelope.mailFrom.address +
                            '; Message envelope to: ' + session.envelope.rcptTo[0].address);

                        logger.info(`Scan skipped. Message ${computeHash(rawSmtp)} forwarded to MTA`);

                        if( connCount >= 1 ) {
                            connCount--;
                        } else {
                            connCount = 0;
                        }

                        connection.quit();

                        return callback(null, 'Message OK.');

                    });
                });
            } else {

                axios.post(constants.KONTXTAPI, {

                    features: constants.KONTXTFEATURE,
                    // convert message to string assuming (default) utf8 encoding
                    // (a groundless assumption, but we need to satisfy kontxt API)
                    rawSmtp: rawSmtp.toString(),
                    maxContentLength: constants.MAXSIZE,
                    maxBodyLength: constants.MAXSIZE

                })
                    .then((res) => {

                        let kontxtResult = '';

                        if ( undefined !== res.data.data[0] ) {

                            const inflightResults = res.data.data[0][constants.KONTXTFEATURE + '_results'];

                            kontxtResult = inflightResults.spam;

                            logger.debug('Raw block result from payload: ' + kontxtResult);

                        }

                        if ( kontxtResult === true ) {

                            logger.info(`Message ${computeHash(rawSmtp)} blocked by Kontxt`);

                            logger.info('Message blocked by Inflight. Response: ' + kontxtResult +
                                '; Message envelope from: ' + session.envelope.mailFrom.address +
                                ' Message envelope to: ' + session.envelope.rcptTo[0].address);

                            let err = new Error('Message blocked. Inflight Response: ' + kontxtResult);
                            err.responseCode = constants.DROPCODE;

                            if( connCount >= 1 ) {
                                connCount--;
                            } else {
                                connCount = 0;
                            }

                            return callback(err);

                        }

                        logger.info(`Message ${computeHash(rawSmtp)} allowed by Kontxt`);

                        connection.on('error', function (err) {

                            logger.info(`Message ${computeHash(rawSmtp)} needs to be retried, MTA likely down`);

                            logger.error('Could not connect to Remote MTA: ' + err +
                                '; Message envelope from: ' + session.envelope.mailFrom.address +
                                ' Message envelope to: ' + session.envelope.rcptTo[0].address);

                            err = new Error('Message could not be sent, remote relay down. Inflight Response: ' + kontxtResult);
                            err.responseCode = constants.HASHCHECKCODE;

                            if( connCount >= 1 ) {
                                connCount--;
                            } else {
                                connCount = 0;
                            }

                            return callback(err);

                        });

                        connection.connect(() => {

                            logger.info('CONNECTION ESTABLISHED TO REMOTE MTA');

                            if (checkHash(smtpEntryHash, computeHash(rawSmtp))) {

                                connection.send({
                                    from: session.envelope.mailFrom,
                                    to: session.envelope.rcptTo
                                }, rawSmtp, function (err, info) {

                                    logger.info('Message not blocked, relayed to remote MTA. Response: ' + kontxtResult +
                                        '; Message envelope from: ' + session.envelope.mailFrom.address +
                                        ' Message envelope to: ' + session.envelope.rcptTo[0].address);

                                    logger.info(`Message ${computeHash(rawSmtp)} forwarded to MTA`);

                                    if( connCount >= 1 ) {
                                        connCount--;
                                    } else {
                                        connCount = 0;
                                    }

                                    connection.quit();

                                    return callback(null, "Message OK. Inflight Response: " + kontxtResult);

                                });
                            } else {
                                logger.error('Hash check failure. Message not relayed. Entry: ' + smtpEntryHash + ' Current: ' + computeHash(rawSmtp));

                                let err = new Error('Hash check failure. Message not relayed.');
                                err.responseCode = constants.RELAYDOWNCODE;

                                if( connCount >= 1 ) {
                                    connCount--;
                                } else {
                                    connCount = 0;
                                }

                                return callback(err);

                            }
                        });
                    })
                    .catch((error) => {
                        logger.error('KONTXT API SMTP POST ERROR CAUGHT, sending message on to MTA. Message: ' + error.message);

                        logger.info(`Message ${computeHash(rawSmtp)} allowed, Kontxt failed`);

                        // something is wrong with kontxt api, so let's send the message back to next MTA relay

                        connection.on('error', function (err) {

                            logger.info(`Message ${computeHash(rawSmtp)} discarded, MTA likely down`);

                            logger.error('Caught KONTXT API Error :: Could not connect to MTA: ' + err +
                                '; Message envelope from: ' + session.envelope.mailFrom.address +
                                '; Message envelope to: ' + session.envelope.rcptTo[0].address);

                            if( connCount >= 1 ) {
                                connCount--;
                            } else {
                                connCount = 0;
                            }

                            return callback(null, "Message OK but MTA is not available. Envelope logged.");

                        });

                        if (checkHash(smtpEntryHash, computeHash(rawSmtp))) {

                            connection.connect(() => {

                                logger.error('Caught KONTXT API Error. Trying to send the message on to the remote MTA ');

                                connection.send({
                                    from: session.envelope.mailFrom,
                                    to: session.envelope.rcptTo
                                }, rawSmtp, function (err, info) {

                                    logger.error('Caught KONTXT API Error: relayed to remote MTA.' +
                                        '; Message envelope from: ' + session.envelope.mailFrom.address +
                                        '; Message envelope to: ' + session.envelope.rcptTo[0].address);

                                    logger.info(`Message ${computeHash(rawSmtp)} forwarded to MTA`);

                                    if( connCount >= 1 ) {
                                        connCount--;
                                    } else {
                                        connCount = 0;
                                    }

                                    connection.quit();

                                    return callback(null, 'Message OK.');

                                });
                            });

                        } else {
                            logger.error('Hash check failure. Message not relayed. Entry: ' + smtpEntryHash + ' Current: ' + computeHash(rawSmtp));

                            let err = new Error('Hash check failure. Message not relayed.');
                            err.responseCode = constants.HASHCHECKCODE;

                            if( connCount >= 1 ) {
                                connCount--;
                            } else {
                                connCount = 0;
                            }

                            return callback(err);
                        }

                    });
            }
        });
    },
});

server.on('error', error => {

    if( connCount >= 1 ) {
        connCount--;
    } else {
        connCount = 0;
    }

    logger.error( 'ERROR CAUGHT. Message: ' + error.message );
});

server.listen( constants.LISTENPORT );