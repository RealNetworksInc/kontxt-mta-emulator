## KONTXT SMTP emulator 

We thought this service might be useful to fellow developers.  We created this based on NodeMailer in order to transform MMS (SMTP) messages to our JSON ANTI-Spam/fraud API. It is likely useless to you as is unless you are a customer but the implementation might be helpful in general.

This is an implementation of an MTA for SMTP protocol acting as a reverse-proxy in front of KONTXT Anti-Spam & MMS image text extraction service.

This service will provide the REST response code as an MTA/SMTP response code as defined by the customer.

In this case, if the REST API responds with a 200, that means the message is acceptable and InFlight returns a block/not-block status.

In the case of a block, MTA will respond with code 559, if not, MTA will respond with 250.      

### Development
To run this locally, run:

`npm install` then

`npm start`

Different messages can be used by changing or using a new message.txt file

### Production
Build Docker image

`docker-compose up --build -d`
