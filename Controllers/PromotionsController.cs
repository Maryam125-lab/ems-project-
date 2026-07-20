using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
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
