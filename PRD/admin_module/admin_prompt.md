C:\karldworld\Bennie-connect\PRD\user_module\adashesu-contributions\adashesu-contributions.md
C:\karldworld\Bennie-connect\PRD\user_module\agric-services-marketplace\agric-services-marketplace.md
C:\karldworld\Bennie-connect\PRD\user_module\cooperative-shares-dividends\cooperative-shares-dividends.md
C:\karldworld\Bennie-connect\PRD\user_module\ecommerce-marketplace\ecommerce-marketplace.md
C:\karldworld\Bennie-connect\PRD\user_module\equipment-booking-gps\equipment-booking-gps.md
C:\karldworld\Bennie-connect\PRD\user_module\membership\membership-management.md
C:\karldworld\Bennie-connect\PRD\user_module\savings-products\savings-products.md
C:\karldworld\Bennie-connect\PRD\user_module\wallet\digital-wallet-seerbit.md
C:\karldworld\Bennie-connect\PRD\user_module\agent-dashboard-commission\agent-dashboard-commission.md


above are the files i need you to analyze to perform the task below.

we need to lay the groundwork for the admin module.

the admin module is the overwatch and controllaer of all the data and activities happening on the platform, so it needs to be secure, and it needs to be able to perform any action the admin wants to perform.

all the user modules PRD might be holding mock implementation, i need you to analyze them deeply to understand the diferent user sections so that you can create a robust implementation documentation for the admin, make sure the admin implementation documentation are designed for live implementation.

the admin module should have different sections, and i will want to make the admin frontend and backend route unique in the APP.tsx the admin routes should start with /bennie, for example bennie/auth, /bennie/dashboard, /bennie/users, /bennie/admin, /bennie/cooperative, /bennie/savings-plans, /bennie/market-place, /bennie/equipment-booking, /bennie/adashesu-contributions, /bennie/agent-commission.

below i will describe the different sections of the admin module and their functionalities.

- USERS : this section is where the admin manages all the users of the platform, it should allow the admin to view, edit, delete, and ban users. create /PRD/admin_module/users/users.md to document the implementation of the admin module's user management.

- SUB-ADMINS : this section is where the admin manages all the sub-admins of the platform, it should allow the admin to view, edit, delete, and ban sub-admins. create /PRD/admin_module/admins/admins.md to document the implementation of the admin module's sub-admin management.

- COOPERATIVE : this section is where the admin manages all the cooperatives of the platform, it should allow the admin to create, view, edit, delete, approve and ban cooperatives. create /PRD/admin_module/cooperative/cooperative.md to document the implementation of the admin module's cooperative management.

- SAVINGS PLANS : this section is where the admin manages all the savings plans of the platform, it should allow the admin to create, view, edit, update, and delete savings plans. create /PRD/admin_module/savings_plans/savings_plans.md to document the implementation of the admin module's savings plans management.

- MARKETPLACE : this section is where the admin manages all the marketplace products on the platform, it should allow the admin to create, view, edit and delete marketplace products. create /PRD/admin_module/marketplace/marketplace.md to document the implementation of the admin module's marketplace management.

- MEMBERSHIP TIERS (SUBSCRIPTION PLANS) : this is the section where the admin manages all the membership tiers and subscription plans of the platform, it should allow the admin to view, edit, delete, activate and deactivate membership tiers and subscription plans as well as the privelliges of each tier. create /PRD/admin_module/membership_tiers/membership_tiers.md to document the implementation of the admin module's membership tiers and subscription plans management.

- EQUIPMENT BOOKING : this section is where the admin manages all the equipment available for booking on the platform, it should allow the admin to create, view, edit and delete equipments. create /PRD/admin_module/equipment_booking/equipment_booking.md to document the implementation of the admin module's equipment management.

- ADASHE GROUPS : this section is where the admin manages all the adashe groups on the platform, it should allow the admin to create, view, edit, delete, approve and ban adashe groups, so it means the admin can manage groups as well as their members and their contributions. create /PRD/admin_module/adas_hesu_contributions/adas_hesu_contributions.md to document the implementation of the admin module's adashe groups management.

- AGENT COMMISSION : this section is where the admin manages all the different agent commission on the platform. there are diff types of commissions that can be set for agents, analyze agent-dashboard-commission.md and see the different commision types and make sure the admin can manage all of them. 


 - SETTINGS : this section is where the admin manages all the global settings on the platform. create /PRD/admin_module/settings/settings.md to document the implementation of the admin module's settings management.


so lets create the rich admin PRDS, also create /PRD/admin_module/auth/admin_auth.md to document the implementation of the admin module's authentication management.

admin users document should include role management, roles should have specific permissions and each permission should be granular, meaning it should be specific to a specific action on a specific resource. we should store all admin and sub-admin user documents in the adminUsers collection, when the server launches, it should check for existing admin users if not it should seed the adminUsers collection with the super admin user, that user details are:

email: superadmin@benniconnect.com
password: Bennie-2026

and its role should be the role with all permissions.

admin auth should only have sign in


I DON'T WANT BASIC DESIGNS FOR THE UI/UX, I WANT AN ASTHETIC AND SMOOTH UI/UX, USE THE BEST DESIGN PATTERNS AND BEST PRACTICES TO IMPLEMENT THE UI/UX.


ANALYZE ALL THE DATA STRUCTURE AND IF THEY DON'T EXIST IN @/PRD/DATA_STRUCTURES.MD FILE, THEN UPDATE IT.

FOCUS ON SOLE THE TASK I GAVE YOU, DO NOT GO AND ANALYZE ANY FILE THAT IS NOT RELATED TO THE TASK, DO NOT RUSH, TAKE YOUR TIME AND ANALYZE ALL THE COMPONENTS, THEIR CHILDREN COMPONENTS AND HOW THEY INTERACT WITH EACH OTHER AND THE BACKEND, THEN UPDATE THE RELATED .MD FILES IF NEED BE AND MAKE SURE TO DO IT RIGHT.

analyze the problem then when you come up with the best solution, use the respective agent based on the task to update the related .md files, use the respective agents to update the backend if needed, then use respective agent to update all the related frontend components.


ALWAYS QUERY GRAPHIFY TO GAIN MORE INSIGHT ON THE CODEBASE, AFTER ALL YOU ANALYSIS COME UP WITH AN IMPLEMENTATION PLAN FOR ME TO REVIEW BEFORE WE PROCEED WITH THE IMPLEMENTATION.


ALWAYS ASK ANY QUESTION YOU HAVE ABOUT ANYTHING I MISS THAT YOU BELIEVE WILL BETTER THE IMPLEMENTATION UNTILL YOU ARE SURE WE ARE GOOD TO GO






C:\karldworld\Bennie-connect\PRD\admin_module\equipment_booking\equipment_booking.md
C:\karldworld\Bennie-connect\PRD\user_module\agric-services-marketplace\agric-services-marketplace.md

above are the files you need to analyze to perform the task below.

we need to create a operators section in the admin module, to allow the admin create and manage operators, cause we don't want operators to have signup access, when we build the operator module, they will only have login access.

- so create the /PRD/admin_module/operators/operators.md to document the implementation of the admin module's operators management.

- we need to plug the operator into the admin equipment pipeline too, for for the approve availability and operator assignment.

- the admin should be able to create operators and assign equipment booking task to them.

- the admin should be able to assign agricultural service operation task to operators, cause some agro service bookings like soil testing, drone service, green house design, e.t.c need an operator, so that should also be implemented to the operator assignment pipeline.

- we currently don't have agro service management in the admin module so we need to create it. the admin should be able to create, edit, delete, activate and deactivate agro services, analyze the user module's agric-services-marketplace.md file to see how it's implemented there, so we can properly implement the admin mamagement for services, so the admin should be able to approve and reject service bookings, if the service needs an operator, the admin should be able to assign an operator to the service booking. so create /PRD/admin_module/agro_service_management/agro_service_management.md to document the implementation of the admin module's agro service management. make sure the agro service management is robust enough for the admin to create services with custom pricing and custom duration for each service and any other service structure you find in \user_module\agric-services-marketplace\agric-services-marketplace.md.


so lets create the rich PRD for the agro service management, and the operator management.

then after you are done, we can run the full implementation of the operator section, we will fully implement the agro service later.


I DON'T WANT BASIC DESIGNS FOR THE UI/UX, I WANT AN ASTHETIC AND SMOOTH UI/UX, USE THE BEST DESIGN PATTERNS AND BEST PRACTICES TO IMPLEMENT THE UI/UX.


ANALYZE ALL THE DATA STRUCTURE AND IF THEY DON'T EXIST IN @/PRD/DATA_STRUCTURES.MD FILE, THEN UPDATE IT.

FOCUS ON SOLE THE TASK I GAVE YOU, DO NOT GO AND ANALYZE ANY FILE THAT IS NOT RELATED TO THE TASK, DO NOT RUSH, TAKE YOUR TIME AND ANALYZE ALL THE COMPONENTS, THEIR CHILDREN COMPONENTS AND HOW THEY INTERACT WITH EACH OTHER AND THE BACKEND, THEN UPDATE THE RELATED .MD FILES IF NEED BE AND MAKE SURE TO DO IT RIGHT.

analyze the problem then when you come up with the best solution, use the respective agent based on the task to update the related .md files, use the respective agents to update the backend if needed, then use respective agent to update all the related frontend components.


ALWAYS QUERY GRAPHIFY TO GAIN MORE INSIGHT ON THE CODEBASE, AFTER ALL YOU ANALYSIS COME UP WITH AN IMPLEMENTATION PLAN FOR ME TO REVIEW BEFORE WE PROCEED WITH THE IMPLEMENTATION.


ALWAYS ASK ANY QUESTION YOU HAVE ABOUT ANYTHING I MISS THAT YOU BELIEVE WILL BETTER THE IMPLEMENTATION UNTILL YOU ARE SURE WE ARE GOOD TO GO

