using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    public class AnnouncementsController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Announcements";
            ViewData["Active"] = "Announcements";
            return View();
        }
    }
}
