/* eslint no-console: 0 */

'use strict';

// mms.js
const {SMTPServer} = require('smtp-server');
const SMTPConnection = require('nodemailer/lib/smtp-connection');
const log4js = require('log4js');
const axios = require('axios');
const crypto = require('crypto')

const listenPort     = '10025';
const dropCode       = 659;
const maxClients     = 300;
const maxSize        = 200 * 1024 * 1024; // 100 MB

// Production settings
const kontxtFeature  = 'inflight';
const kontxtApi      = 'http://172.17.0.1:7777/text/analyze'; // Local container for analysis 172.17.0.1
const destIp         = '172.17.0.1';  // Relay for successful message, non blocked from inflight
const destPort       = 25;

// Local host development; setup an ehlo service locally on the following port
//const kontxtFeature  = 'inflight_local';
//const kontxtApi      = 'http://192.168.65.2:7777/text/analyze'; // Local container for analysis
//const destIp = '192.168.65.2';  // ping host.docker.internal from inside the docker container to get host IP
//const destPort = 10025;

log4js.configure({
    appenders: {
        everything: { type: 'file', filename: 'log/all-the-logs.log', maxLogSize: 419430400, backups: 10, compress: false }
    },
    categories: {
        default: { appenders: [ 'everything' ], level: 'info'}
    }
});
const logger = log4js.getLogger();
logger.level = "info";

function computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

const server = new SMTPServer({
    // disable STARTTLS to allow authentication in clear text mode
    banner: 'Welcome to the KONTXT SMTP MTA Emulator',
    disabledCommands: ['STARTTLS', 'AUTH'],
    logger: false,
    size: maxSize,
    maxClients: maxClients,
    onData (stream, session, callback ) {

        let chunks = [];

        stream.pipe(process.stdout); // print message to console

        stream.on( 'data', (chunk) => {
            chunks.push(chunk);
        });

        stream.on('end', () => {

            // keep message AS IS in raw format
            let rawSmtp = Buffer.concat(chunks)

            logger.info( `Message ${computeHash(rawSmtp)} received` );

            logger.debug( 'Payload features: ' + kontxtFeature );
            logger.debug( 'Payload rawSmtp: ' + rawSmtp.toString() );

            //establish connection to SVR remote MTA
            let connection = new SMTPConnection( {
                port: destPort,
                host: destIp,
                secure: false,
                ignoreTLS: true,
                connectionTimeout: 5000,
                debug: false,
                name: 'mms.relay.kontxt.cloud'
            });

            axios.post( kontxtApi, {

                features: kontxtFeature,
                // convert message to string assuming (default) utf8 encoding 
                // (a groundless assumption, but we need to satisfy kontxt API)
                rawSmtp: rawSmtp.toString(),
                maxContentLength: 10000000,
                maxBodyLength: 10000000

            } )
                .then((res) => {

                    let kontxtResult = '';

                    if( undefined !== res.data.data[0]  ) {

                        const inflightResults = res.data.data[0][kontxtFeature + '_results'];

                        kontxtResult = inflightResults.spam;

                        logger.debug( 'Raw block result from payload: ' + kontxtResult );

                    }

                    if (kontxtResult === true ) {

                        logger.info( `Message ${computeHash(rawSmtp)} blocked by Kontxt` );

                        logger.info( 'Message blocked by Inflight. Response: ' + kontxtResult +
                            '; Message envelope from: ' + session.envelope.mailFrom.address +
                            ' Message envelope to: ' + session.envelope.rcptTo[0].address );

                        let err = new Error( 'Message blocked. Inflight Response: ' + kontxtResult );
                        err.responseCode = dropCode;
                        return callback( err );

                    }

                    logger.info( `Message ${computeHash(rawSmtp)} allowed by Kontxt` );

                    connection.on( 'error', function ( err ) {

                        logger.info( `Message ${computeHash(rawSmtp)} discarded, MT likely down` );

                        logger.error( 'Could not connect to SVR MTA: ' + err  +
                                      '; Message envelope from: ' + session.envelope.mailFrom.address +
                                      ' Message envelope to: ' + session.envelope.rcptTo[0].address );

                        callback( null, "Message OK but MTA likely down." );

                    });

                    connection.connect(() => {

                        logger.info( 'CONNECTION ESTABLISHED TO REMOTE MTA' );

                        connection.send({
                            from: session.envelope.mailFrom,
                            to: session.envelope.rcptTo
                        }, rawSmtp, function (err, info) {

                            logger.info( 'Message not blocked, relayed to remote MTA. Response: ' + kontxtResult +
                                '; Message envelope from: ' + session.envelope.mailFrom.address +
                                ' Message envelope to: ' + session.envelope.rcptTo[0].address );

                            logger.info( `Message ${computeHash(rawSmtp)} forwarded to MTA` );

                            connection.quit();
                            return callback( null, "Message OK. Inflight Response: " + kontxtResult );

                        });
                    });
                })
                .catch((error) => {
                    logger.error( 'ObanMicro API SMTP POST ERROR CAUGHT, sending message on to SVR MTA. Message: ' + error.message );

                    logger.info( `Message ${computeHash(rawSmtp)} allowed, Kontxt failed` );

                    // something is wrong with oban api, so let's send the message back to SVR MTA

                    connection.on( 'error', function ( err ) {

                        logger.info( `Message ${computeHash(rawSmtp)} discarded, MT likely down` );

                        logger.error( 'Caught ObanMicro API Error :: Could not connect to SVR MTA: ' + err  +
                            '; Message envelope from: ' + session.envelope.mailFrom.address +
                            '; Message envelope to: ' + session.envelope.rcptTo[0].address );

                        return callback( null, "Message OK but SVR MTA is not available. Envelope logged." );

                    });

                    connection.connect(() => {

                        logger.error( 'Caught ObanMicro API Error: CONNECTION ESTABLISHED TO REMOTE MTA ' );

                        connection.send({
                            from: session.envelope.mailFrom,
                            to: session.envelope.rcptTo
                        }, rawSmtp, function (err, info) {

                            logger.error( 'Caught ObanMicro API Error: relayed to remote MTA.' +
                                '; Message envelope from: ' + session.envelope.mailFrom.address +
                                '; Message envelope to: ' + session.envelope.rcptTo[0].address );

                            logger.info( `Message ${computeHash(rawSmtp)} forwarded to MTA` );

                            connection.quit();

                            return callback( null, 'Message OK.' );

                        });
                    });

                });
        });
    },
});

server.on('error', error => {
    logger.error( 'ERROR CAUGHT. Message: ' + error.message );
});

server.listen( listenPort );
