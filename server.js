/* eslint no-console: 0 */

'use strict';

// mms.js
const {SMTPServer} = require('smtp-server');
const {SMTPConnection} = require('nodemailer/lib/smtp-connection');
const log4js = require('log4js');
const axios = require('axios');

const listenPort     = '10025';
const dropCode       = 659;
const maxClients     = 100;
const maxSize        = 20 * 1024 * 1024; // 20 MB
const kontxtFeature  = 'inflight_local';
const kontxtApi      = 'http://172.17.0.1:7777/text/analyze'; // Local container for analysis

const destIp = '205.174.189.130';  // Relay for successful message, non blocked from inflight
const destPort = 25;

let kontxtResult = '';
let concatStream = '';

log4js.configure({
    appenders: {
        everything: { type: 'file', filename: 'log/all-the-logs.log', maxLogSize: 10485760, backups: 3, compress: true }
    },
    categories: {
        default: { appenders: [ 'everything' ], level: 'debug'}
    }
});
const logger = log4js.getLogger();
logger.level = "debug";

const server = new SMTPServer({
    // disable STARTTLS to allow authentication in clear text mode
    banner: 'Welcome to the KONTXT SMTP MTA Emulator',
    disabledCommands: ['STARTTLS', 'AUTH'],
    logger: false,
    size: maxSize,
    maxClients: maxClients,
    onData (stream, session, callback ){

        stream.pipe(process.stdout); // print message to console

        stream.on( 'data', (chunk) => {
            concatStream += chunk.toString();
        });

        stream.on('end', () => {

            axios.post( kontxtApi, {

                features: kontxtFeature,
                rawSmtp: concatStream

            } )
                .then((res) => {

                    if( undefined !== res.data.data[0]  ) {

                        const inflightResults = res.data.data[0]['inflight_local_results'];

                        kontxtResult = inflightResults.block;

                        logger.debug( 'Raw block result from payload: ' + kontxtResult );

                    }

                    if (kontxtResult === 'Blocked') {

                        logger.debug( 'Message blocked by Inflight. Response: ' + kontxtResult );

                        let err = new Error( 'Message blocked. Inflight Response: ' + kontxtResult );
                        err.responseCode = dropCode;
                        return callback( err );


                    }

                    let connection = new SMTPConnection( {
                        port: destPort,
                        host: destIp
                    });

                    connection.send({
                        from: session.envelope.mailFrom,
                        to: session.envelope.rcptTo
                    }, stream, function( err, info ) {

                        logger.debug( 'Message NOT blocked by Inflight. Response: ' + kontxtResult + ' Error: ' + err + ' Info: ' + info  );

                        callback( null, "Message OK. Inflight Response: " + kontxtResult );

                    });


                })
                .catch((error) => {
                    logger.error( 'ERROR CAUGHT. Message: ' + error.message );
                    callback(null, "Message OK. Inflight Response: None (Err)");
                })

        });

    },
});

server.on('error', error => {
    logger.error( 'ERROR CAUGHT. Message: ' + error.message );
});

server.listen( listenPort );