import z from 'zod'
import ics, { EventAttributes } from 'ics'
import { writeFileSync } from 'fs'

const eventLocatorResponseSchema = z.object({
  page_size: z.number(),
  count: z.number(),
  total: z.number(),
  current_page_number: z.number(),
  next_page_number: z.number().nullable(),
  next: z.number().nullable(),
  previous: z.number().nullable(),
  previous_page_number: z.number().nullable(),
  results: z.array(
    z.object({
      id: z.number(),
      full_header_image_url: z.string(),
      start_datetime: z.string(),
      end_datetime: z.string().nullable(),
      day_2_start_datetime: z.null(),
      timer_end_datetime: z.null(),
      timer_paused_at_datetime: z.null(),
      timer_is_running: z.boolean(),
      description: z.string(),
      settings: z.object({
        id: z.number(),
        decklist_status: z.string(),
        decklists_on_spicerack: z.boolean(),
        event_lifecycle_status: z.string(),
        show_registration_button: z.boolean(),
        round_duration_in_minutes: z.number(),
        payment_in_store: z.boolean(),
        payment_on_spicerack: z.boolean(),
        maximum_number_of_game_wins_per_match: z.number(),
        maximum_number_of_draws_per_match: z.null(),
        checkin_methods: z.array(z.string()),
        stripe_price_id: z.null(),
        maximum_number_of_players_in_match: z.number(),
        enable_waitlist: z.boolean()
      }),
      tournament_phases: z.array(
        z.object({
          id: z.number(),
          phase_name: z.string(),
          phase_description: z.string(),
          first_round_type: z.string().nullable(),
          status: z.string(),
          order_in_phases: z.number(),
          number_of_rounds: z.number().nullable(),
          round_type: z.string(),
          rank_required_to_enter_phase: z.number().nullable(),
          effective_maximum_number_of_game_wins_per_match: z.number(),
          rounds: z.array(z.unknown())
        })
      ),
      registered_user_count: z.number(),
      full_address: z.string(),
      name: z.string(),
      pinned_by_store: z.boolean(),
      use_verbatim_name: z.boolean(),
      queue_status: z.string(),
      game_type: z.string(),
      source: z.null(),
      event_status: z.string(),
      event_format: z.string(),
      event_type: z.string(),
      pairing_system: z.null(),
      rules_enforcement_level: z.string(),
      coordinates: z.object({
        type: z.string(),
        coordinates: z.array(z.number())
      }),
      timezone: z.string().nullable(),
      event_address_override: z.string().nullable(),
      event_is_online: z.boolean(),
      latitude: z.number(),
      longitude: z.number(),
      cost_in_cents: z.number(),
      currency: z.string(),
      capacity: z.number(),
      url: z.null(),
      number_of_rc_invites: z.null(),
      top_cut_size: z.null(),
      number_of_rounds: z.null(),
      number_of_days: z.number(),
      is_headlining_event: z.boolean(),
      is_on_demand: z.boolean(),
      prevent_sync: z.boolean(),
      header_image: z.null(),
      starting_table_number: z.number(),
      ending_table_number: z.null(),
      admin_list_display_order: z.number(),
      prizes_awarded: z.boolean(),
      is_test_event: z.boolean(),
      is_template: z.boolean(),
      tax_enabled: z.boolean(),
      polymorphic_ctype: z.number(),
      created_at: z.string(),
      updated_at: z.string(),
      created_by: z.number(),
      updated_by: z.number(),
      game: z.number(),
      product_list: z.null(),
      event_factory_created_by: z.null(),
      event_configuration_template: z.string(),
      banner_image: z.number(),
      phase_template_group: z.string(),
      game_rules_enforcement_level: z.null(),
      registration_prerequisite_requires_invitation: z.boolean(),
      store: z.object({
        id: z.number(),
        name: z.string(),
        full_address: z.string(),
        city: z.string(),
        country: z.string().nullable(),
        state: z.string().nullable(),
        latitude: z.number(),
        longitude: z.number(),
        website: z.string().nullable(),
        email: z.string().nullable()
      }),
      convention: z.null(),
      gameplay_format: z.object({ id: z.string(), name: z.string() }),
      distance_in_miles: z.null(),
      display_status: z.string()
    })
  )
})
type EventLocatorResponse = z.infer<typeof eventLocatorResponseSchema>

const today = new Date()

const response = await fetch(`https://api.cloudflare.riftbound.uvsgames.com/hydraproxy/api/v2/events/?start_date_after=${today.toISOString()}&display_status=upcoming&latitude=48.8571346&longitude=2.3479679&num_miles=8&upcoming_only=true&game_slug=riftbound&page=1&page_size=200`, {
	tls: {
		rejectUnauthorized: false,
	},
})

const responseJSON = await response.json()
const result = eventLocatorResponseSchema.parse(responseJSON)

const mapUVSEventToICSEvent = (event: EventLocatorResponse['results'][number]): EventAttributes => {
  const startDate = new Date(event.start_datetime)
  const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // Default to 3 hours if no end date

  return {
    start: [
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      startDate.getDate(),
      startDate.getHours(),
      startDate.getMinutes(),
    ],
    end: [
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      endDate.getDate(),
      endDate.getHours(),
      endDate.getMinutes(),
    ],
    title: `${event.store.name} - ${event.name}`,
    description: event.description.replace(/<[^>]+>/g, ''),
    location: event.full_address,
    url: `https://locator.riftbound.uvsgames.com/events/${event.id}`,
    geo: { lat: event.latitude, lon: event.longitude },
    lastModified: [
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate(),
      today.getHours(),
      today.getMinutes(),
    ],
  }
}

ics.createEvents(result.results.map(mapUVSEventToICSEvent), (error, value) => {
  if (error) {
    console.log('ICS ERROR', error);
    return;
  }

  writeFileSync('events.ics', value);
});