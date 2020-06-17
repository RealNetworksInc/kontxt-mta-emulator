/* eslint no-console: 0 */

'use strict';

// mms.js
const {SMTPServer} = require('smtp-server');

const axios = require('axios');

const listenPort     = '10025';
const dropCode       = 559;
const kontxtFeature = 'inflight_local';
const kontxtApi      = 'http://172.17.0.1:7777/text/analyze';

let kontxtResult = '';

let concatStream = '';

const server = new SMTPServer({
    // disable STARTTLS to allow authentication in clear text mode
    banner: 'Welcome to the KONTXT SMTP MTA Emulator',
    disabledCommands: ['STARTTLS', 'AUTH'],
    logger: false,
    // Accept messages up to 20 MB
    size: 20 * 1024 * 1024,
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

                    console.log( res.data );

                    if( undefined !== res.data.data[0]  ) {

                        const inflightResults = res.data.data[0]['inflight_local_results'];

                        kontxtResult = inflightResults.block;

                        console.log( 'Found block result in response: ' + kontxtResult );

                    }

                    if (kontxtResult === 'Blocked') {

                        let err = new Error( 'Message blocked. Inflight Response: ' + kontxtResult );
                        err.responseCode = dropCode;
                        return callback( err );

                    }
                    callback(null, "Message OK. Inflight Response: " + kontxtResult);

                })
                .catch((error) => {
                    console.error( error );
                    callback(null, "Message OK. Inflight Response: None (Err)");
                })

        });

    },
});

server.on('error', err => {
    console.log('Error occurred');
    console.log(err.message);
});

server.listen( listenPort );