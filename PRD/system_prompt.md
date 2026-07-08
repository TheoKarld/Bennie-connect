C:\karldworld\Bennie-connect\ENTERPRISE_DEVELOPMENT_PROMPTS.md
C:\karldworld\Bennie-connect\PRD\user_module\01-authentication-user-management.md
C:\karldworld\Bennie-connect\PRD\user_module\02-digital-wallet-seerbit.md
C:\karldworld\Bennie-connect\PRD\user_module\03-membership-management.md
C:\karldworld\Bennie-connect\PRD\user_module\04-savings-products.md
C:\karldworld\Bennie-connect\PRD\user_module\05-cooperative-shares-dividends.md
C:\karldworld\Bennie-connect\PRD\user_module\06-equipment-booking-gps.md
C:\karldworld\Bennie-connect\PRD\user_module\07-agric-services-marketplace.md
C:\karldworld\Bennie-connect\PRD\user_module\08-ecommerce-marketplace.md
C:\karldworld\Bennie-connect\PRD\user_module\09-adashesu-contributions.md
C:\karldworld\Bennie-connect\PRD\user_module\10-agent-dashboard-commission.md

above are the related files i need you to analyze to perform the task below.

before anything i need you to take your time to analyze the related .md files to get more insight on the project and its current state.

we have implement most of the basic user operations, but i want to give the project more structure than what we currently have now, and we want to fully implement the admin module.

lets start with running the /init command on this project, then lets create the 4 subagents we will be working with:

- admin dev agent: this agent will be responsible for coding the admin module.
- admin prd enricher: this agent will be responsible for working on the admin modules PRD .md files.
- user dev agent: this agent will be responsible for coding the user module.
- user prd enricher: this agent will be responsible for working on the user modules PRD .md files.

make sure the path and role of all the subagents are properly outlined in the CLAUDE.md file

we will start with resolving all the user sections and activities before we build the admin module, so after you are done with the init and the sub agents, fix the project foundation cause a, getting the above error




we have properly initialized the project and






I DON'T WANT BASIC DESIGNS FOR THE UI/UX, I WANT AN ASTHETIC AND SMOOTH UI/UX, USE THE BEST DESIGN PATTERNS AND BEST PRACTICES TO IMPLEMENT THE UI/UX.


ANALYZE ALL THE DATA STRUCTURE AND IF THEY DON'T EXIST IN @/PRD/DATA_STRUCTURES.MD FILE, THEN UPDATE IT WITH THE DATA STRUCTURES OF THE DOCUMENTS USED IN THE AI CODE LEARNING SECTION.

FOCUS ON SOLE THE TASK I GAVE YOU, DO NOT GO AND ANALYZE ANY FILE THAT IS NOT RELATED TO THE TASK, DO NOT RUSH, TAKE YOUR TIME AND ANALYZE ALL THE COMPONENTS, THEIR CHILDREN COMPONENTS AND HOW THEY INTERACT WITH EACH OTHER AND THE BACKEND, THEN UPDATE THE RELATED .MD FILES IF NEED BE AND MAKE SURE TO DO IT RIGHT.

analyze the problem then when you come up with the best solution, use the respective agent based on the task to update the related .md files, use the respective agents to update the backend if needed, then use respective agent to update all the related frontend components.


ALWAYS QUERY GRAPHIFY TO GAIN MORE INSIGHT ON THE CODEBASE, AFTER ALL YOU ANALYSIS COME UP WITH AN IMPLEMENTATION PLAN FOR ME TO REVIEW BEFORE WE PROCEED WITH THE IMPLEMENTATION.


ALWAYS ASK ANY QUESTION YOU HAVE ABOUT ANYTHING I MISS THAT YOU BELIEVE WILL BETTER THE IMPLEMENTATION UNTILL YOU ARE SURE WE ARE GOOD TO GO










C:\karldworld\Bennie-connect\PRD\user_module\authentication\authentication-user-management.md

above are the files i need you to analyze the perform the tasks below.


- we need to setup the notification engine before we proceed, we will be using firebase for web push notification, we need to plug the notification to all the approparate places, create place holders in the frontend and backend .env files i will provide the actual key, for the firebase-messaging-sw.js in the public folder use query params to load the creds from the .env file cause i don't want api keys in any script.

- then structure the notification properly so that the users and admin can get in app notification in real time when activities happen.

- we also need to properly setup socket.io for real time communication between users and admin.

- lets make sure the admin gets web push and in app notification when a new user creates an account.

- create /PRD/notification.md to document the notification and firebase implementation. then create /PRD/socket.io.md to document the socket.io implementation.



I DON'T WANT BASIC DESIGNS FOR THE UI/UX, I WANT AN ASTHETIC AND SMOOTH UI/UX, USE THE BEST DESIGN PATTERNS AND BEST PRACTICES TO IMPLEMENT THE UI/UX.


ANALYZE ALL THE DATA STRUCTURE AND IF THEY DON'T EXIST IN @/PRD/DATA_STRUCTURES.MD FILE, THEN UPDATE IT WITH THE DATA STRUCTURES OF THE DOCUMENTS USED IN THE AI CODE LEARNING SECTION.

FOCUS ON SOLE THE TASK I GAVE YOU, DO NOT GO AND ANALYZE ANY FILE THAT IS NOT RELATED TO THE TASK, DO NOT RUSH, TAKE YOUR TIME AND ANALYZE ALL THE COMPONENTS, THEIR CHILDREN COMPONENTS AND HOW THEY INTERACT WITH EACH OTHER AND THE BACKEND, THEN UPDATE THE RELATED .MD FILES IF NEED BE AND MAKE SURE TO DO IT RIGHT.

analyze the problem then when you come up with the best solution, use the respective agent based on the task to update the related .md files, use the respective agents to update the backend if needed, then use respective agent to update all the related frontend components.


ALWAYS QUERY GRAPHIFY TO GAIN MORE INSIGHT ON THE CODEBASE, AFTER ALL YOU ANALYSIS COME UP WITH AN IMPLEMENTATION PLAN FOR ME TO REVIEW BEFORE WE PROCEED WITH THE IMPLEMENTATION.

I HAVE THE BACKEND RUNNING IN YOUR TERMINAL YOU CAN CHECK BACKEND LOGS THERE, YOU DON'T NEED TO START ANOTHER BACKEND SERVER IF YOU WANT TO TRACK ANYTHING

ALWAYS ASK ANY QUESTION YOU HAVE ABOUT ANYTHING I MISS THAT YOU BELIEVE WILL BETTER THE IMPLEMENTATION UNTILL YOU ARE SURE WE ARE GOOD TO GO





i want to implement gcp for file upload, i will provide all keys in the backend .env file, just put placeholders there and i will fill them. so create upload service in the backend to handle file upload.

- the service should be able to create the upload bucket and make it public on initialization if the bucket don't already exist or its not public.

- there should be upload, delete and a media library(to get all the files in the bucket) functionality.

- the upload route should return a json with the file metadata(name, file type,file url, size, e.t.c)

so create /PRD/gcp_upload.md to document the gcp upload service implementation.
