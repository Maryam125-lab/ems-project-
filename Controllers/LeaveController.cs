using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
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
