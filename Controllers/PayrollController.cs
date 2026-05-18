using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    public class PayrollController : Controller  
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Payroll";       
            ViewData["Active"] = "Payroll";
            return View();
        } 
    }         

    
}
