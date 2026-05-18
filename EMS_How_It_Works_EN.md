# EMS.Web - How the System Works (Workflow Guide)

This document explains the logical flow and operational processes of the Employee Management System.

## 1. System Architecture
The system is built on a **Centralized Web Architecture**. 
*   **Database:** Stores all employee records, attendance logs, and configurations.
*   **Web Server:** Processes requests using ASP.NET Core and handles business logic.
*   **User Interface:** A responsive web dashboard accessible from any device (Desktop/Mobile).

## 2. Core Workflows

### A. Employee Onboarding Process
1.  **Admin Setup:** The Admin first configures the "Masters" (Departments, Designations, Shifts, and Work Locations).
2.  **HR Entry:** HR adds a new employee through the `Employees/Create` module.
3.  **Account Creation:** The system automatically generates a user account and assigns a role (Admin, HR, or Employee).

### B. Attendance & Time Tracking
1.  **Clock-in:** Employees log their daily attendance via the portal.
2.  **Real-time Monitoring:** HR can monitor who is present or absent in real-time through the `Attendance` dashboard.
3.  **Calculations:** The system calculates total work hours, late arrivals, and early departures based on the assigned shift.

### C. Leave Application & Approval
1.  **Application:** An employee applies for leave (Casual, Sick, Annual) through "My Portal."
2.  **Capacity Check:** The system alerts HR if too many people from the same department are already on leave for those dates.
3.  **Decision:** HR reviews the request and clicks "Approve" or "Reject."
4.  **Synchronization:** Approved leaves are automatically reflected in the attendance records and payroll.

### D. Payroll Processing
1.  **Data Collection:** At the end of the month, the system aggregates attendance data and approved leaves.
2.  **Calculation:** It applies salary components (Basic, HRA, etc.), subtracts penalties/taxes, and adds bonuses.
3.  **Verification:** HR reviews the generated payroll for accuracy.
4.  **Disbursement:** Once finalized, payslips are generated and become available in the Employee's Portal for download.

### E. Performance & Growth
1.  **Tracking:** Promotions and penalties are recorded throughout the year.
2.  **Impact:** These records directly influence the employee's current designation and future salary increments.

## 3. Security & Auditing
Every action taken by an Admin or HR (like changing a salary or deleting a record) is captured in the **Audit Logs**. This ensures transparency and prevents unauthorized changes to sensitive data.
