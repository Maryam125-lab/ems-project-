using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class LaunchpadController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "ERP Launchpad";
            ViewData["Active"] = "Launchpad";
            return View();
        }
    }
}
