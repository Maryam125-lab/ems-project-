# EMS.Web - System Kaise Kaam Karta Hai (Workflow Guide)

Yeh document EMS system ke kaam karne ke tareeqay aur workflow ko wazeh karta hai.

## 1. System Ka Dhancha (Architecture)
System ek **Centralized Web Architecture** par chalta hai.
*   **Database:** Is mein employees ka saara record aur system settings save hoti hain.
*   **Web Server:** Yeh ASP.NET Core par chalta hai aur user ki requests ko process karta hai.
*   **User Interface:** Aik jadeed web dashboard jo laptop aur mobile dono par asani se chalta hai.

## 2. Main Workflows

### A. Employee Onboarding (Naya Employee Add Karna)
1.  **Admin Setup:** Sab se pehle Admin system mein Departments, Shifts aur Designations set karta hai.
2.  **HR Entry:** HR naye employee ki maloomat system mein "Add Employee" ke zariye dakhil karta hai.
3.  **Account Generation:** System khud-ba-khud us employee ka account bana deta hai aur usay "Employee Role" assign karta hai.

### B. Attendance (Hazri ka Nizam)
1.  **Clock-in:** Employees rozana portal ke zariye apni hazri lagate hain.
2.  **Monitoring:** HR real-time mein dekh sakta hai ke kaun hazir hai aur kaun ghair-hazir.
3.  **Calculations:** System shifts ke hisab se late aane walon aur kaam ke ghanton ka hisab rakhta hai.

### C. Leave Management (Chuttiyon ka Nizam)
1.  **Application:** Employee "My Portal" se chutti ki darkhwast bhejta hai.
2.  **Alert:** Agar us department mein pehle se bohat log chutti par hon, to system HR ko alert deta hai.
3.  **Decision:** HR request dekh kar "Approve" ya "Reject" karta hai.
4.  **Update:** Approved chuttiyan khud hi attendance aur payroll mein shamil ho jati hain.

### D. Payroll (Tankhwah ka Nizam)
1.  **Data Jama Karna:** Mahine ke aakhir mein system hazri aur chuttiyon ka data jama karta hai.
2.  **Calculation:** Salary components, taxes aur penalties ka hisab lagaya jata hai.
3.  **Verification:** HR payroll ko check kar ke final karta hai.
4.  **Payslips:** Payslips generate ho jati hain jo employee apne portal se download kar sakta hai.

### E. Performance aur Promotions
1.  **Record:** Saal bhar mein hone wali promotions aur penalties ka record rakha jata hai.
2.  **Asar:** In records ki wajah se employee ki designation aur salary par asar parta hai.

## 3. Security aur Audit Logs
Admin ya HR jo bhi tabdeeli karte hain (maslan salary badalna), uska record **Audit Logs** mein mahfooz ho jata hai. Is se system mein transparency rehti hai aur koi ghalat kaam nahi kar sakta.
