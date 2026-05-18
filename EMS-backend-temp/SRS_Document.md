ERP: Functional Blueprint V1.1
1. The Global Ecosystem (The "Shell")
Before entering any specific department, the system provides a unified experience. This ensures that even if we have a 1,000-person company, the core "Office" experience remains consistent.
A. The Multi-Module App Switcher
Logic: Upon login, the user lands on a "Launchpad."
Dynamic Access: The system checks the user’s Department and Role.
Example: If a user is in "Sales," the "Inventory" icon might be accessible but "HR Admin" and "Finance" icons will not allow the user to access them.
B. The Universal Global Sidebar
The sidebar stays with the user everywhere. It contains the "Personal Office" features:
Attendance Live-Status: A real-time indicator. If HR marks them "Present," a green check appears.
Quick Notification Center: Centralized "Push Notifications" for the web. "Your leave was approved," "New Penalty applied," or "Off day announcement.”
Self-Service Shortcuts: One-click access to apply for leave or view pay slips.
2. Module: Human Resources (The "Admin" Side)
The HR module is the "Source of Truth" for every person in the company. In a multi-branch setup, the system distinguishes between Branch HR (Data Entry) and Head Office (HO) HR (Final Authority).
Feature 1: HR Executive Dashboard (Analytics & Stats)
The Logic: HR needs a "bird's-eye view" of the company’s health across all branches.
Key Stats (KPIs):
Attendance Overview: Percentage of employees Present, Late, or Absent today (with a branch-wise toggle).
Leave Pipeline: Number of pending leave requests requiring immediate action.
Penalty Summary: Total fines collected/applied in the current month.
Staff Count: Total active employees categorized by Department and Branch.
Birthdays/Anniversaries: Upcoming employee milestones for culture building.
Feature 2: Digital Attendance Ledger (The "Master Sheet")
The Business Problem: Physical registers are hard to track and centralize across branches.
The Solution: A high-speed digital grid for Branch HR.
The Flow:
Branch-Lock Logic: Branch HR opens the daily sheet. It only lists employees assigned to their specific branch.
Entry: As people arrive, HR enters the "Check-in" time.
Late Logic: If a shift starts at 9:00 AM and HR enters 9:15 AM, the system flags the row as RED (Late) while respecting the pre-defined grace time.
Submission: At the end of the day, Branch HR "Submits" the sheet to the Head Office. Once submitted, the branch can no longer edit the data without HO permission.
Feature 3: The Penalty & Fine Engine
The Business Problem: Deductions are often forgotten or disputed at month-end.
The Solution: Immediate transparency with HO oversight.
The Flow:
Configuration: HO HR defines global "Rules" (e.g., Late arrival = 500 PKR).
Proposal: Branch HR selects a local employee and "Applies" a penalty based on the rules.
HO Approval: The penalty remains "Pending" until Head Office HR reviews it.
Real-time Alert: Once HO approves, the employee gets a notification on their sidebar. This creates a clear digital trail.
 
Feature 4: Leave & Capacity Management
The Logic: Managing "Office Capacity" to ensure departments aren't understaffed.
The Flow:
Visibility: HR sees a calendar view of who is already on leave within a specific branch or department.
Conflict Check: If too many people from one team (e.g., IT) are off, the system flags a "Capacity Alert."
Approval: HR approves/rejects based on these operational needs.
Feature 5: Unified Employee Onboarding & Credentialing
The Logic: Creating a digital identity for the whole ERP.
The Flow:
Data Entry: HR enters core details (Personal info, Medical records, Emergency contacts, Job details).
Access Provisioning: HR assigns a Branch, Department, and Role.
Automatic Account Creation: Upon saving, the system generates a unique User ID and temporary Password.
Credential Delivery: The system generates a PDF/Email for HR to give to the new hire for their first login.
Feature 6: Organization & Department Management
The Logic: Reshaping the company structure (Branches and Departments) digitally.
The Flow:
Branch Setup: HO HR adds/edits office locations (e.g., "Karachi Branch," "Lahore Branch").
Department Hierarchy: HR adds new Departments (e.g., "Operations," "Sales") and maps them to specific branches or as "Cross-Branch" entities.
Designations: Defining titles (CEO, Manager, Intern) within those departments.
 
3. Module: The Employee Portal (The "Standard User" Side)
Every person in the company—from the CEO to the Sales Executive—uses this journey.
Feature 1: Digital Attendance Verification (The "Signature")
The Flow:
1. The employee sees a notification: "HR marked you as 'Present' (Late) at 9:20 AM. Please verify."
2. The employee clicks "Verify/Acknowledge."
3. Business Logic: This acts as a digital signature. If the employee thinks HR made a mistake, they don't click verify; they go to the HR desk to fix it. This eliminates "I was actually on time" arguments during payroll.
Feature 2: Leave Self-Service & Balance Tracking
The Flow:
Balance View: Before applying, the employee sees their "Wallet." (e.g., 10 Casual Leaves remaining, 5 Sick Leaves).
Request: They fill out a form (Date + Reason).
History: They can track the status (Draft -> Pending -> Approved).
Feature 3: The Penalty Transparency Tab
The Flow: Employees can see a ledger of all fines.
Why? It builds a culture of accountability. They can see exactly why their salary might be lower this month.
Feature 4: Official Announcements
The Flow: A dedicated feed. Unlike an email that gets lost, these are "Pinned" notices. Once an employee reads it, it marks as "Read" for HR to track who has seen the memo.
Feature 5 (Global): Security & Personal Settings
The Logic: Security is a shared responsibility.
The Flow:
Users have a "Settings" icon in the Sidebar.
Password Management: Users must change their temporary password on first login and can update it anytime for security.
Profile View: Users can view (but usually not edit) their medical and personal info to ensure HR has the correct data.
Feature 6: The "Office Phonebook" (Company Directory)
The Logic: Centralizing utility contacts to stop the "Who do I call for X?" interruptions.
The Flow:
Central Directory: A searchable list of Departmental Extensions and Office Landlines (e.g., IT Support, Maintenance/Admin, HR Front Desk, Pantry/Peon Station).
Role-Based Visibility: Employees see the numbers they need. They don't see personal mobile numbers unless the contact person has marked them as "Public."
Branch-Specific View: By default, an employee sees their own branch's directory, but they can toggle to "Head Office" or "Other Branches" if they need to coordinate across locations.
Feature 7: The Employee Personal Dashboard
The Logic: The first screen an employee sees after the Launchpad. It summarizes their "Professional Health" so they don't have to navigate through menus to find basic info.
Visual Components (Widgets):
Attendance Summary: A circular progress chart or cards showing "Present Days," "Late Arrivals," and "Absent" for the current month.
Leave Wallet: A quick-view card showing remaining balances (e.g., Casual: 4 left, Sick: 2 left).
Active Penalty Alert: If a new penalty was approved by HO, a prominent alert box appears until the employee acknowledges it.
Upcoming Holidays: A countdown or list of the next 3 company-wide holidays.
My Activity Logs: A simplified feed showing recent actions (e.g., "You applied for leave yesterday," "Attendance verified at 9:10 AM").
Quick Action Buttons: Large, accessible buttons for "Apply Leave" and "View Company Directory."
