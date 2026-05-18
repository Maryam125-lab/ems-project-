using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    public class AccountsController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "HR Accounts";
            ViewData["Active"] = "HRAccounts";
            return View();
        }
    }
}
