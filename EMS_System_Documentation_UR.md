# EMS.Web - Employee Management System Documentation (Roman Urdu)

## 1. Taaruf (Introduction)
EMS.Web ek mukammal Employee Management System hai jo HR ke kamo ko asaan banane, admin tasks ko automate karne, aur employees ko ek self-service portal dene ke liye banaya gaya hai. Is system mein employees ka data, attendance, payroll, aur performance sab ek hi jagah mahfooz rehta hai.

## 2. Tech Stack (Technical Maloomat)
Yeh system jadeed (modern) web technologies par mabni hai taake yeh tez aur safe rahe.

*   **Framework:** ASP.NET Core 10.0 (MVC Architecture)
*   **Backend Language:** C# (C-Sharp)
*   **Frontend Engine:** Razor Views (CSHTML)
*   **Design:** Custom CSS jo professional corporate look deta hai.
*   **Icons:** Font Awesome jadeed UI ke liye.
*   **Security:** ASP.NET Core ki built-in Authentication aur Authorization.

## 3. Controllers aur System Ka Structure
System **Model-View-Controller (MVC)** pattern par chalta hai. Har controller ek khaas kaam ke liye banaya gaya hai:

1.  **AccountsController:** Login aur user ki phunch (access) ko manage karta hai.
2.  **EmployeesController:** Employees ki details (Hiring, Editing) ka database manage karta hai.
3.  **MyPortalController:** Employees ke liye banaya gaya portal jahan wo apna data dekh sakte hain.
4.  **AttendanceController:** Rozana ki hazri (clock-in/out) aur kaam ke ghanton ka hisab rakhta hai.
5.  **LeaveController:** Chuttiyon ki darkhwast (applications) aur unki approval ko manage karta hai.
6.  **PayrollController:** Tankhwah (Salary), tax aur payslips banata hai.
7.  **PromotionsController:** Career mein taraqqi aur designation ki tabdeeli ko track karta hai.
8.  **PenaltiesController:** Disciplinary actions aur tankhwah mein koti (deductions) ka record rakhta hai.
9.  **AnnouncementsController:** HR ko poori company mein news phelane (broadcast) ki ijazat deta hai.
10. **SettingsController:** System ka main "Engine" jahan se Departments, Shifts wagera configure hote hain.
11. **AuditLogController:** Security ke liye har baray badlav (change) ka record rakhta hai.
12. **DashboardController:** System ka summary graph aur data dikhata hai.
13. **HomeController:** Main landing pages ko handle karta hai.

## 4. Roles aur Unke Kaam

### A. Admin (Super User)
Admin ke paas poore system ka control hota hai.
*   **System Setup:** Departments, Designations, aur Work Locations banana.
*   **Policy Banana:** Chuttiyon ki policy aur Salary ke components set karna.
*   **Security:** Audit Logs dekhna ke kis ne kab kya tabdeeli ki.
*   **Master Data:** Global Holidays aur Employee Types ko manage karna.

### B. HR (Human Resources)
HR ka kaam staff aur operations ko chalana hai.
*   **Recruitment:** Naye employees ko add karna aur unki profile manage karna.
*   **Attendance & Leaves:** Staff ki hazri dekhna aur chuttiyan approve karna.
*   **Financials:** Har mahine ki payroll chalana aur tax ka hisab rakhna.
*   **Communication:** Company ke liye naye elaanat (announcements) post karna.
*   **Growth:** Promotions aur career paths ko manage karna.

### C. Employee (Self-Service)
Employees "My Portal" ke zariye apna kaam manage karte hain.
*   **Dashboard:** Apni attendance ki summary aur aane wali chuttiyan dekhna.
*   **Attendance:** Apne clock-in aur clock-out ka record check karna.
*   **Payslips:** Apni monthly payslips dekhna aur download karna.
*   **Leave Requests:** Chutti ke liye apply karna aur uska status check karna.
*   **Profile:** Apni personal maloomat ko up-to-date rakhna.
*   **Directory:** Company mein doosre sathiyon ko dhoondna aur unse rabta karna.
