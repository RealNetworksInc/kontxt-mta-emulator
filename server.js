/* eslint no-console: 0 */

'use strict';

// smtp.js
const {SMTPServer} = require('smtp-server');
const axios = require('axios');

const listenPort     = '10025';
const dropCode       = 559;
const kontxtFeatures = [ 'inflight_local' ];
const kontxtApi      = 'http://localhost:7777/text/analyze';

let kontxtResult = '';


const server = new SMTPServer({
    // disable STARTTLS to allow authentication in clear text mode
    banner: 'Welcome to the KONTXT SMTP MTA Emulator',
    disabledCommands: ['STARTTLS', 'AUTH'],
    logger: true,
    // Accept messages up to 20 MB
    size: 20 * 1024 * 1024,
    onData (stream, session, callback ){
        stream.pipe(process.stdout); // print message to console
        stream.on('end', () => {

            axios.post( kontxtApi, {
                features: kontxtFeatures,
                rawSmtp: callback
            })
                .then((res) => {
                    kontxtResult = res.data.data[0]['inflight_local_results'].block;
                    console.log( kontxtResult );
                    if( kontxtResult === 'Blocked') {
                        callback( dropCode, "Message blocked. Inflight Response: " + kontxtResult );
                        return;
                    }
                    callback( null, "Message queued. Inflight Response: " + kontxtResult );
                })
                .catch((error) => {
                    console.error( error )
                })

        });

    },
});

server.on('error', err => {
    console.log('Error occurred');
    console.log(err.message);
});

server.listen( listenPort );