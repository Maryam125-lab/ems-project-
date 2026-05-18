using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
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
