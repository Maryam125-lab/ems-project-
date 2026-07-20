using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class PenaltiesController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Penalties";
            ViewData["Active"] = "Penalties";
            return View();
        }
    }
}
