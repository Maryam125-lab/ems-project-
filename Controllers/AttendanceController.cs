using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    public class AttendanceController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Attendance";
            ViewData["Active"] = "Attendance";
            return View();
        }
    }
}
