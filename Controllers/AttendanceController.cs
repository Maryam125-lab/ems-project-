using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class AttendanceController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Attendance";
            ViewData["Active"] = "Attendance";
            return View();
        }

        public IActionResult Report()
        {
            ViewData["Title"] = "Attendance Report";
            ViewData["Active"] = "AttendanceReport";
            return View();
        }
    }
}   