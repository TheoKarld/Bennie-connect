C:\karldworld\Bennie-connect\PRD\admin_module\marketplace\marketplace.md
C:\karldworld\Bennie-connect\PRD\user_module\ecommerce-marketplace\ecommerce-marketplace.md
C:\karldworld\Bennie-connect\PRD\gcp_upload.md
C:\karldworld\Bennie-connect\PRD\notification.md

above are the files i need you to analyze to perform the tasks below.

we need to fully implement the marketplace sections in both the admin and users modules.

- in the admin module, the admin should be able to manage all the marketplace products on the platform. it should allow the admin to create, view, edit and delete marketplace products.
    - so the admin should be able to create categories, then create products under the categories, cause if you analyze the users ecommerce-marketplace.md, you will see users can filter products by categories.
    - the create product form should be a robust multi-step form, it should also allow the admin upload images(max of 3 images) and a video(max of 1 video), for the product, use the gcp upload endpoint and service to upload the media files and add the return metadata json to the product document's images and video array.
    - when the admin deletes a product, it should delete the media files associated with the product.
    - we need to create order section section in the admin module to view and handle all the orders placed by users. so create /PRD/admin_module/admin_orders/orders.md to document the implementation of the orders section in the admin module.
    - lets also implement a full notification pipeline for the orders placed by users, so admin can get notified when a user places a new order, the notification should contain a link to the order details page.


- in the user module, most of the implementation is mock data, so we need to make sure we implementations are fully live.
    - since products can have media gallery(up to 3 images and a video), we need to implement a product details page, to allow the user see the full details of the product, like the images, video and other details.
    - let also fully implement the cart and checkout pipeline in the user module, to handle all order placement by users, so create /PRD/user_module/cart_checkout/cart_checkout.md to document the implementation of the cart and checkout section in the user module.


- in the users input markets section, there is merchant panel, we need to move it from the market section to be an independent section on its own, so lets create /PRD/user_module/merchant_panel/merchant_panel.md to document the implementation of the merchant panel section in the user module. so analyze the the merchant panel in the user merketplace to understand the implementation.
    - we need to add more initiative to it, like a user should be able to just go to the merchant panel and start uploading products without verifying their business and have the admin approve them. so when the user goes to the merchant panel, if they have not been verified, they can start their verification process and wait for approval from the admin before they can start uploading  products.
    - so create /PRD/admin_module/merchants/merchants.md to document the implementation of the merchants section in the admin module, we need to make sure the admin can fully manage merchants, approve and reject merchant. each merchant is to run a full KYC before their shop can be active, so in the merchant panel, there should be a KYC section where the merchant can upload their KYC documents.

lets use prembly for the kyc identity card verification, here is their docs url https://docs.prembly.com/docs/welcome-to-prembly-documentation


i gave an overview of the problem you can perform a deeper research into the structure and add your own ideas and insights to the problem and come up with a better solution, and also properly document the implementation.



I DON'T WANT BASIC DESIGNS FOR THE UI/UX, I WANT AN ASTHETIC AND SMOOTH UI/UX, USE THE BEST DESIGN PATTERNS AND BEST PRACTICES TO IMPLEMENT THE UI/UX TO MAKE IT SUPER RESPONSIVE. MAKE SURE ALL THE RELETAED COMPONENTS HAVE A PROPER LIGHT AND DARK MODE THEME CLASSES.

ANALYZE ALL THE DATA STRUCTURE AND IF THEY DON'T EXIST IN @/PRD/DATA_STRUCTURES.MD FILE, THEN UPDATE IT.

FOCUS ON SOLE THE TASK I GAVE YOU, DO NOT GO AND ANALYZE ANY FILE THAT IS NOT RELATED TO THE TASK, DO NOT RUSH, TAKE YOUR TIME AND ANALYZE ALL THE COMPONENTS, THEIR CHILDREN COMPONENTS AND HOW THEY INTERACT WITH EACH OTHER AND THE BACKEND, THEN UPDATE THE RELATED .MD FILES IF NEED BE AND MAKE SURE TO DO IT RIGHT.

analyze the problem then when you come up with the best solution, use the respective agent based on the task to update the related .md files, use the respective agents to update the backend if needed, then use respective agent to update all the related frontend components.


ALWAYS QUERY GRAPHIFY TO GAIN MORE INSIGHT ON THE CODEBASE, AFTER ALL YOU ANALYSIS COME UP WITH AN IMPLEMENTATION PLAN FOR ME TO REVIEW BEFORE WE PROCEED WITH THE IMPLEMENTATION.


ALWAYS ASK ANY QUESTION YOU HAVE ABOUT ANYTHING I MISS THAT YOU BELIEVE WILL BETTER THE IMPLEMENTATION UNTILL YOU ARE SURE WE ARE GOOD TO GO

