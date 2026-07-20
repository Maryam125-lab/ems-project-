using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class SettingsController : Controller
    {
        public IActionResult Departments()       { ViewData["Title"] = "Departments";        ViewData["Active"] = "Departments";        return View(); }
        public IActionResult Designations()      { ViewData["Title"] = "Designations";       ViewData["Active"] = "Designations";       return View(); }
        public IActionResult Shifts()            { ViewData["Title"] = "Shifts";             ViewData["Active"] = "Shifts";             return View(); }
        public IActionResult WorkLocations()     { ViewData["Title"] = "Work Locations";     ViewData["Active"] = "WorkLocations";      return View(); }
        public IActionResult LeaveTypes()        { ViewData["Title"] = "Leave Types";        ViewData["Active"] = "LeaveTypes";         return View(); }
        public IActionResult LeavePolicies()     { ViewData["Title"] = "Leave Policies";     ViewData["Active"] = "LeavePolicies";      return View(); }
        public IActionResult PenaltiesConfig()   { ViewData["Title"] = "Penalty Rules";      ViewData["Active"] = "PenaltiesConfig";    return View(); }
        public IActionResult SalaryComponents()  { ViewData["Title"] = "Salary Components";  ViewData["Active"] = "SalaryComponents";   return View(); }
        public IActionResult GlobalDays()        { ViewData["Title"] = "Global Holidays";    ViewData["Active"] = "GlobalDays";         return View(); }
        public IActionResult EmployeeTypes()     { ViewData["Title"] = "Employee Types";     ViewData["Active"] = "EmployeeTypes";      return View(); }
        public IActionResult WorkModes()         { ViewData["Title"] = "Work Modes";         ViewData["Active"] = "WorkModes";          return View(); }
        public IActionResult JobStatuses()       { ViewData["Title"] = "Job Statuses";       ViewData["Active"] = "JobStatuses";        return View(); }
        public IActionResult TaxConfig()         { ViewData["Title"] = "Tax Configuration";  ViewData["Active"] = "TaxConfig";          return View(); }
        public IActionResult ReportingManagers() { ViewData["Title"] = "Reporting Managers"; ViewData["Active"] = "ReportingManagers";  return View(); }
        public IActionResult CustomFields()      { ViewData["Title"] = "Custom Fields";      ViewData["Active"] = "CustomFields";       return View(); }
    }
}
