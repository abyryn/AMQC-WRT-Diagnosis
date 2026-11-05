HONDA KEIHIN KLINE PROTOCOL (DIAGNOSTIC)
STEPS 1:

Pin Tx = Low (70 ms)
Pin Tx = High (120 ms)
Set Baudrate = 10400 bps
Wake Up with send to ECU code = FE 04 72 8C
ECU Response with code = 0E 04 72 7C
Send Initialise code = 72 05 00 F0 99
ECU Response = 02 04 00 FA
Repeat point 1 if there is no response from the ECU. And continue the next Steps if there is a response from the ECU
STEPS 2:

Send Request ECM ID = 72 05 71 00 18
ECU Response (eg) = 02 0F 71 00 01 02 32 0F 01 00 00 00 00 00 39
Send Request data table 11 = 72 05 71 11 07
ECU Response data table 11 (eg) = 02 19 71 11 00 00 00 00 FF 0A AA 0A FF B2 FF FF 79 00 00 00 80 53 09 F1 5C
If the ecu response data in table 11 is = 02 05 71 11 77
then continue to request data table 17. Send to ECU = 72 05 71 17 01
ECU will respond to data table 17 (eg) = 02 18 71 17 00 00 00 00 FF 0A FF FF FF FF 79 00 00 80 8D 00 00 00 00 D3
