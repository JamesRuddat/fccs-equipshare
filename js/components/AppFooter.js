// /js/components/AppFooter.js - Global Footer & Donation Banner Component
class AppFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <!-- Global Donation & Booster Club Advertisement Banner -->
            <section class="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border-t border-b border-slate-700/60 py-8 px-4 sm:px-6 lg:px-8 no-print mt-auto">
                <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    
                    <div class="space-y-2 text-center md:text-left flex-1">
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
                            <i class="fa-solid fa-heart text-amber-400"></i> Supporting Our Cadets
                        </div>
                        
                        <h2 class="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                            Help Keep Squadron Equipment Free for Every Cadet
                        </h2>
                        
                        <p class="text-slate-300 text-xs leading-relaxed max-w-3xl">
                            The <strong class="text-white">Friends of the Fox Cities Composite Squadron (WI-055)</strong> is our 501(c)(3) non-profit booster club dedicated to funding uniform items, flight gear, field equipment, and training supplies. Through community donations, we acquire and maintain inventory so cadets can get uniforms at <strong class="text-brand-400">$0 cost</strong>.
                        </p>
                        
                        <div class="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[11px] text-slate-400 font-semibold pt-1">
                            <span><i class="fa-solid fa-box-open text-brand-400 mr-1"></i> Direct Supply Funding</span>
                            <span><i class="fa-solid fa-check text-brand-400 mr-1"></i> Zero Platform Fees via Zeffy</span>
                        </div>
                    </div>

                    <!-- Direct Zeffy Donation Link -->
                    <div class="flex flex-col items-center gap-2 shrink-0">
                        <a href="https://www.zeffy.com/en-US/ticketing/friends-of-the-fox-cities-composite-squadron-wi-055s-memberships" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="bg-brand-500 hover:bg-brand-600 text-slate-950 font-extrabold text-xs px-5 py-3 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all flex items-center gap-2 group transform hover:-translate-y-0.5">
                            <i class="fa-solid fa-hand-holding-heart text-sm group-hover:scale-110 transition-transform"></i>
                            <span>Support WI-055 Supply Fund</span>
                            <i class="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-75"></i>
                        </a>
                        <span class="text-[10px] text-slate-400 font-mono">100% of donations directly fund WI-055 gear</span>
                    </div>

                </div>
            </section>
            
            <!-- Site Copyright Footer -->
            <footer class="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 no-print">
                <div class="max-w-7xl mx-auto px-4 text-center space-y-1">
                    <p>&copy; ${new Date().getFullYear()} EquipShare - Squadron Supply & Logistics Management System.</p>
                    <p class="text-[11px] text-slate-500">Made by members for members at the Fox Cities Composite Squadron</p>
                </div>
            </footer>
        `;
    }
}

customElements.define('app-footer', AppFooter);

export { AppFooter };