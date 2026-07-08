C:\karldworld\Bennie-connect\PRD\user_module\adashesu-contributions\adashesu-contributions.md
C:\karldworld\Bennie-connect\PRD\admin_module\adas_hesu_contributions\adas_hesu_contributions.md
C:\karldworld\Bennie-connect\PRD\user_module\dashboard\user_dashboard.md
C:\karldworld\Bennie-connect\PRD\admin_module\admin_dashboard\admin_dashboard.md

C:\karldworld\Bennie-connect\PRD\socket.io.md
C:\karldworld\Bennie-connect\PRD\notification.md


above are the files i need you to analyze to perform the task below.

we need to fully implement the adashe group section on both the admin and user module.

- i need the adashe group user section to be fully functional, remove all mock data, make sure the users is able to see live data and is able to create adashe circle and also be able to invite other members to the created circle.
    - for the circle workspace, make sure the chatting is fully live, with socket.io plugged in properly to allow members get real-time messsages, make sure the socket connection is robust, and the group conversation is persisted to the db, so members don't loose chats.
    - and make sure proper notification is implemented to all adashe activities, so members should get notifications for every activity happening in the group.
    - make sure all other tabs and functionalities in the adashe group is fully functional and plugged into the notification pipeline.
    - remove the "Admin Sandbox Controls" from the user module adashe group, rather the members shoud be able to request slot shift, then the request should be considered a new proposal for members to cast vote, then after every member has casted a vote, the admin should be able to approve or reject the request based on the votes, with right admin controls and permissions over the group rotation and payout.
    - all group activities must be properly logged in the db for activities tracking.
    - make sure the user module adashe group has a proper structure, i don't want a single page design, i want a well structured and organized implementation for the user module adashe group, with proper organization of components.
    - make sure the user dashboard now hold live adashe activites including pending slot shift requests.


- i need the adashe group admin section to be fully functional, remove all mock data, make sure the admin is able to see live data and is able to create adashe circle and also be able to invite other members to the created circle.
    - for the circle workspace, make sure the chatting is fully live, with socket.io plugged in properly to allow members and admin get real-time messsages, make sure the socket connection is robust, and the group conversation is persisted to the db, so members and admin don't loose chats, meaning the admin can join in on a group chat and have full access to the group chat, with admin controls and permissions over the group chat.
    - and make sure proper notification is implemented to all adashe activities, so members and admin should get notifications for every activity happening in the group.
    - make sure all other tabs and functionalities in the adashe group is fully functional and plugged into the notification pipeline.
    - add the "Admin Sandbox Controls" to the admin module adashe group, admin should be able to approve/reject shift members slot request, after a full vote consensus from the group members.
    - make sure the admin dashboard now hold live adashe activites including pending slot shift requests.
    - fully create all the pages components needed for the admin module adashe group. don't just use the C:\karldworld\Bennie-connect\src\pages\admin\sections.tsx, as it was just a place holder.
    - make sure the admin module adashe group has a proper structure, i don't want a single page design, i want a well structured and organized implementation for the admin module adashe group, with proper organization of components.


I DON'T WANT BASIC DESIGNS FOR THE UI/UX, I WANT AN ASTHETIC AND SMOOTH UI/UX, USE THE BEST DESIGN PATTERNS AND BEST PRACTICES TO IMPLEMENT THE UI/UX.


ANALYZE ALL THE DATA STRUCTURE AND IF THEY DON'T EXIST IN @/PRD/DATA_STRUCTURES.MD FILE, THEN UPDATE IT.

FOCUS ON SOLE THE TASK I GAVE YOU, DO NOT GO AND ANALYZE ANY FILE THAT IS NOT RELATED TO THE TASK, DO NOT RUSH, TAKE YOUR TIME AND ANALYZE ALL THE COMPONENTS, THEIR CHILDREN COMPONENTS AND HOW THEY INTERACT WITH EACH OTHER AND THE BACKEND, THEN UPDATE THE RELATED .MD FILES IF NEED BE AND MAKE SURE TO DO IT RIGHT.

analyze the problem then when you come up with the best solution, use the respective agent based on the task to update the related .md files, use the respective agents to update the backend if needed, then use respective agent to update all the related frontend components.


ALWAYS QUERY GRAPHIFY TO GAIN MORE INSIGHT ON THE CODEBASE, AFTER ALL YOU ANALYSIS COME UP WITH AN IMPLEMENTATION PLAN FOR ME TO REVIEW BEFORE WE PROCEED WITH THE IMPLEMENTATION.


ALWAYS ASK ANY QUESTION YOU HAVE ABOUT ANYTHING I MISS THAT YOU BELIEVE WILL BETTER THE IMPLEMENTATION UNTILL YOU ARE SURE WE ARE GOOD TO GO









adashe.service.ts:61 
 GET http://localhost:5566/api/v1/contribution-groups/undefined 400 (Bad Request)

adashe.service.ts:61 
 GET http://localhost:5566/api/v1/contribution-groups/undefined 400 (Bad Request)
﻿



C:\karldworld\Bennie-connect\PRD\user_module\adashesu-contributions\adashesu-contributions.md

above are the files i need you to analyze to perform the task below.

- am gettin the above error when i try to create an adashe circle in the user module, find the bottle neck and fix it.


I DON'T WANT BASIC DESIGNS FOR THE UI/UX, I WANT AN ASTHETIC AND SMOOTH UI/UX, USE THE BEST DESIGN PATTERNS AND BEST PRACTICES TO IMPLEMENT THE UI/UX.


ANALYZE ALL THE DATA STRUCTURE AND IF THEY DON'T EXIST IN @/PRD/DATA_STRUCTURES.MD FILE, THEN UPDATE IT.

FOCUS ON SOLE THE TASK I GAVE YOU, DO NOT GO AND ANALYZE ANY FILE THAT IS NOT RELATED TO THE TASK, DO NOT RUSH, TAKE YOUR TIME AND ANALYZE ALL THE COMPONENTS, THEIR CHILDREN COMPONENTS AND HOW THEY INTERACT WITH EACH OTHER AND THE BACKEND, THEN UPDATE THE RELATED .MD FILES IF NEED BE AND MAKE SURE TO DO IT RIGHT.

analyze the problem then when you come up with the best solution, use the respective agent based on the task to update the related .md files, use the respective agents to update the backend if needed, then use respective agent to update all the related frontend components.


ALWAYS QUERY GRAPHIFY TO GAIN MORE INSIGHT ON THE CODEBASE, AFTER ALL YOU ANALYSIS COME UP WITH AN IMPLEMENTATION PLAN FOR ME TO REVIEW BEFORE WE PROCEED WITH THE IMPLEMENTATION.


ALWAYS ASK ANY QUESTION YOU HAVE ABOUT ANYTHING I MISS THAT YOU BELIEVE WILL BETTER THE IMPLEMENTATION UNTILL YOU ARE SURE WE ARE GOOD TO GO
