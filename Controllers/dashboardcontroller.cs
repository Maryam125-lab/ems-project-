using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    public class DashboardController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Dashboard";
            ViewData["Active"] = "Dashboard";
            return View();
        }
    }
}