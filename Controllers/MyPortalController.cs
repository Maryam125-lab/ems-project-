using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class MyPortalController : Controller
    {
        public IActionResult Dashboard()       { ViewData["Title"] = "My Dashboard";    ViewData["Active"] = "MyDashboard";  return View(); }
        public IActionResult Attendance()      { ViewData["Title"] = "My Attendance";   ViewData["Active"] = "MyAttendance"; return View(); }
        public IActionResult Payslips()        { ViewData["Title"] = "My Payslips";     ViewData["Active"] = "MyPayslips";   return View(); }
        public IActionResult ApplyLeave()      { ViewData["Title"] = "Apply for Leave"; ViewData["Active"] = "MyLeave";      return View(); }
        public IActionResult Penalties()       { ViewData["Title"] = "My Penalties";    ViewData["Active"] = "MyPenalties";  return View(); }
        public IActionResult Profile()         { ViewData["Title"] = "My Profile";      ViewData["Active"] = "MyProfile";    return View(); }
        public IActionResult Directory()       { ViewData["Title"] = "Company Directory"; ViewData["Active"] = "Directory";  return View(); }
    }
}
