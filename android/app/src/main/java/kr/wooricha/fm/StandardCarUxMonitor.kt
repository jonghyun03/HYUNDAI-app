package kr.wooricha.fm

import android.car.Car
import android.car.drivingstate.CarUxRestrictions
import android.car.drivingstate.CarUxRestrictionsManager
import android.content.ComponentName
import android.content.Context
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder

/** Loaded only after confirming that the runtime exposes the standard AAOS Car API. */
class StandardCarUxMonitor(private val context: Context, private val update: (Boolean) -> Unit) :
    CarUxRestrictionsManager.OnUxRestrictionsChangedListener {
    private var car: Car? = null
    private var manager: CarUxRestrictionsManager? = null
    fun start() {
        if (Build.VERSION.SDK_INT >= 29) {
            car = Car.createCar(context, null, Car.CAR_WAIT_TIMEOUT_DO_NOT_WAIT) { vehicle, ready ->
                if (ready) setup(vehicle) else update(true)
            }
        } else {
            @Suppress("DEPRECATION")
            val vehicle = Car.createCar(context, object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName?, service: IBinder?) { car?.let { setup(it) } }
                override fun onServiceDisconnected(name: ComponentName?) { update(true) }
            })
            car = vehicle
            @Suppress("DEPRECATION")
            vehicle?.connect()
        }
    }
    private fun setup(vehicle: Car) {
        manager = vehicle.getCarManager(Car.CAR_UX_RESTRICTION_SERVICE) as? CarUxRestrictionsManager
        manager?.registerListener(this)
        manager?.currentCarUxRestrictions?.let { onUxRestrictionsChanged(it) }
    }
    override fun onUxRestrictionsChanged(value: CarUxRestrictions) = update(value.isRequiresDistractionOptimization)
    fun close() { manager?.unregisterListener(); car?.disconnect() }
}
