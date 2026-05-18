using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    public class PromotionsController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Promotions";
            ViewData["Active"] = "Promotions";
            return View();
        }
    }
}
