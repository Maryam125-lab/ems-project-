using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    public class LeaveController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Leave Management";
            ViewData["Active"] = "Leave";
            return View();
        }
    }
}
