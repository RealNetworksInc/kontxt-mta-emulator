## KONTXT SMTP emulator 

This is an implementation of an MTA for SMTP protocol acting as a reverse-proxy in front of ObanMicro / MMS image text extraction service.

The service will provide the REST response code as an MTA/SMTP response code as defined by the customer.

In this case, if the REST API responds with a 200, that means the message is acceptable and InFlight returns a block/not-block status.

In the case of a block, MTA will respond with code 559, if not, MTA will respond with 250.      

### Development
To run this locally, run:

`npm install` then

`npm start`

### Production
Build Docker image

`docker-compose up --build -d`