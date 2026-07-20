using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
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
