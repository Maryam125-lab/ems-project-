using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class InventoryController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Inventory Control";
            ViewData["Active"] = "Inventory";
            return View();
        }
    }
}
